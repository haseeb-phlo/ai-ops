import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { RagStatus } from "./rag";
import { explainReasons } from "./ai-review";

/**
 * The team lead's view: their own members, and the sign-offs waiting on them.
 *
 * "Team lead" is not a role - it is being named as `team_lead_user_id` on at
 * least one cohort_member row. So every query here keys on that, and someone
 * who leads nobody simply gets an empty board rather than a permission error.
 */

export type LeadMember = {
  cohortMemberId: string;
  userId: string;
  displayName: string;
  cohortName: string;
  rag: RagStatus | null;
  ragComputedAt: string | null;
  completedAt: string | null;
  pendingCount: number;
};

export type PendingSubmission = {
  id: string;
  cohortMemberId: string;
  memberName: string;
  kind: string;
  title: string;
  promptText: string | null;
  taskSolved: string | null;
  timeSaved: string | null;
  artefactUrl: string | null;
  submittedAt: string;
  /** Set when this replaces a rejected attempt - the lead should see why. */
  previousComment: string | null;
  /** The automated first pass, when one ran and routed this to a human. */
  aiReview: {
    scores: Record<string, number>;
    feedback: string;
    why: string;
  } | null;
};

/**
 * Something the machine approved on its own.
 *
 * Listed so the approver can read what went out in their name and correct the
 * wording. The decision is not editable here - if a score is wrong the answer
 * is a conversation, not a quiet rewrite.
 */
export type ReviewedSubmission = {
  id: string;
  memberName: string;
  title: string;
  comment: string;
  decidedAt: string;
  /** True until a person has rewritten it. */
  stillMachineWorded: boolean;
};

export type LeadBoard = {
  isLead: boolean;
  members: LeadMember[];
  pending: PendingSubmission[];
  autoApproved: ReviewedSubmission[];
};

export const loadLeadBoard = cache(
  async (userId: string): Promise<LeadBoard> => {
    const supabase = await createClient();

    // Two routes onto this board: named as someone's team lead, or named as a
    // cohort's default approver. The second exists because the org tree routes
    // every exec to the CEO, so early cohorts name the programme owner instead.
    //
    // TWO QUERIES, NOT ONE `or`. The obvious version is a single `.or()`
    // listing both, and it does not work: `team_lead_user_id` is a column on
    // this table while `default_approver_user_id` lives on the embedded
    // cohort, and PostgREST cannot mix the two in one logic tree. It does not
    // degrade either - it rejects the whole request with PGRST100, which
    // arrives here as `data: null` and turns into `isLead: false`. That reads
    // exactly like "nobody is assigned to you", so the board went quietly
    // empty for every lead and every approver rather than erroring visibly.
    const memberSelect =
      "id, user_id, rag_status, rag_computed_at, completed_at, programme_cohorts!inner(name, status, default_approver_user_id)";
    type MemberRow = {
      id: string;
      user_id: string;
      rag_status: RagStatus | null;
      rag_computed_at: string | null;
      completed_at: string | null;
      programme_cohorts: {
        name: string;
        status: string;
        default_approver_user_id: string | null;
      };
    };

    const [{ data: ledRows }, { data: approverRows }] = await Promise.all([
      supabase
        .from("programme_cohort_members")
        .select(memberSelect)
        .eq("team_lead_user_id", userId)
        .in("programme_cohorts.status", ["live", "planned", "complete"])
        .returns<MemberRow[]>(),
      supabase
        .from("programme_cohort_members")
        .select(memberSelect)
        .eq("programme_cohorts.default_approver_user_id", userId)
        .in("programme_cohorts.status", ["live", "planned", "complete"])
        .returns<MemberRow[]>(),
    ]);

    // Both routes can name the same person, so merge on member id rather than
    // concatenating - otherwise they are listed twice and their pending count
    // is doubled.
    const byId = new Map<string, MemberRow>();
    for (const row of [...(ledRows ?? []), ...(approverRows ?? [])]) {
      byId.set(row.id, row);
    }
    const members = [...byId.values()];
    if (members.length === 0) {
      return { isLead: false, members: [], pending: [], autoApproved: [] };
    }

    const memberIds = members.map((m) => m.id);

    const [{ data: profiles }, { data: submissionRows }, { data: items }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", members.map((m) => m.user_id))
          .returns<{ user_id: string; display_name: string | null }[]>(),
        supabase
          .from("programme_submissions")
          .select(
            "id, cohort_member_id, track_item_id, kind, prompt_text, task_solved, time_saved_estimate, artefact_url, signoff_status, signoff_comment, signed_at, signed_by, superseded_by, created_at, ai_decision, ai_review_json",
          )
          .in("cohort_member_id", memberIds)
          .returns<
            {
              id: string;
              cohort_member_id: string;
              track_item_id: string | null;
              kind: string;
              prompt_text: string | null;
              task_solved: string | null;
              time_saved_estimate: string | null;
              artefact_url: string | null;
              signoff_status: string;
              signoff_comment: string | null;
              superseded_by: string | null;
              created_at: string;
              ai_decision: string | null;
              signed_at: string | null;
              signed_by: string | null;
              ai_review_json: {
                scores?: Record<string, number>;
                feedback?: string;
                reasons?: string[];
              } | null;
            }[]
          >(),
        supabase
          .from("programme_track_items")
          .select("id, title")
          .returns<{ id: string; title: string }[]>(),
      ]);

    const nameByUserId = new Map(
      (profiles ?? []).map((p) => [p.user_id, p.display_name ?? ""]),
    );
    const titleByItemId = new Map((items ?? []).map((i) => [i.id, i.title]));
    const nameByMemberId = new Map(
      members.map((m) => [m.id, nameByUserId.get(m.user_id) || "(no name)"]),
    );

    const all = submissionRows ?? [];
    // A rejected attempt points at its replacement, so the comment the member
    // was given can be shown alongside the resubmission.
    const commentBySupersededBy = new Map(
      all
        .filter((s) => s.superseded_by && s.signoff_comment)
        .map((s) => [s.superseded_by!, s.signoff_comment!]),
    );

    const pending: PendingSubmission[] = all
      .filter((s) => !s.superseded_by && s.signoff_status === "pending")
      .map((s) => ({
        id: s.id,
        cohortMemberId: s.cohort_member_id,
        memberName: nameByMemberId.get(s.cohort_member_id) ?? "(unknown)",
        kind: s.kind,
        title: s.track_item_id
          ? (titleByItemId.get(s.track_item_id) ?? "Submission")
          : "Submission",
        promptText: s.prompt_text,
        taskSolved: s.task_solved,
        timeSaved: s.time_saved_estimate,
        artefactUrl: s.artefact_url,
        submittedAt: s.created_at,
        previousComment: commentBySupersededBy.get(s.id) ?? null,
        aiReview:
          s.ai_decision === "flagged" && s.ai_review_json?.scores
            ? {
                scores: s.ai_review_json.scores,
                feedback: s.ai_review_json.feedback ?? "",
                why: explainReasons(s.ai_review_json.reasons ?? []),
              }
            : null,
      }))
      // Oldest first: whoever has waited longest gets unblocked first.
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

    const pendingByMember = new Map<string, number>();
    for (const p of pending) {
      pendingByMember.set(
        p.cohortMemberId,
        (pendingByMember.get(p.cohortMemberId) ?? 0) + 1,
      );
    }

    const leadMembers: LeadMember[] = members
      .map((m) => ({
        cohortMemberId: m.id,
        userId: m.user_id,
        displayName: nameByUserId.get(m.user_id) || "(no name)",
        cohortName: m.programme_cohorts.name,
        rag: m.rag_status,
        ragComputedAt: m.rag_computed_at,
        completedAt: m.completed_at,
        pendingCount: pendingByMember.get(m.id) ?? 0,
      }))
      .sort((a, b) => {
        // Whoever needs attention first: red before amber before green, then
        // by name. A lead should not have to scan for the problem.
        const rank = { red: 0, amber: 1, green: 2 } as const;
        const ra = a.rag ? rank[a.rag] : 3;
        const rb = b.rag ? rank[b.rag] : 3;
        return ra - rb || a.displayName.localeCompare(b.displayName);
      });

    // Approved by the machine and never touched by a person, most recent
    // first. Capped: this is a review-what-went-out list, not an archive.
    const autoApproved: ReviewedSubmission[] = all
      .filter(
        (s) =>
          !s.superseded_by &&
          s.signoff_status === "approved" &&
          s.ai_decision === "approved" &&
          s.signed_by === null &&
          s.signoff_comment,
      )
      .sort((a, b) => (b.signed_at ?? "").localeCompare(a.signed_at ?? ""))
      .slice(0, 30)
      .map((s) => ({
        id: s.id,
        memberName: nameByMemberId.get(s.cohort_member_id) ?? "(unknown)",
        title: s.track_item_id
          ? (titleByItemId.get(s.track_item_id) ?? "Submission")
          : "Submission",
        comment: s.signoff_comment ?? "",
        decidedAt: s.signed_at ?? s.created_at,
        stillMachineWorded: (s.ai_review_json?.reasons ?? []).length === 0,
      }));

    return { isLead: true, members: leadMembers, pending, autoApproved };
  },
);
