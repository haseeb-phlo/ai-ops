"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWriter } from "@/lib/auth";
import { findLeadEmail } from "@/lib/programme/org-lead";
import {
  describeRejected,
  emptyOutcome,
  parseRoster,
  summariseOutcome,
  type EnrolOutcome,
} from "@/lib/programme/enrolment";

/**
 * Enrolling a roster into a cohort.
 *
 * The only enrolment paths before this were self-service: a join code, or the
 * admin's own preview run. That is fine for a pilot and useless for a launch,
 * where the cohort is a list somebody has already decided on.
 *
 * Two levels, chosen per person rather than per run, because most of the
 * company has never signed in (see the migration): an address that resolves to
 * an account becomes a membership now; one that doesn't becomes a pending row
 * that turns into a membership on that person's first sign-in.
 */

const EnrolSchema = z.object({
  cohort_id: z.string().uuid(),
  emails: z.string().min(1).max(20_000),
});

export type EnrolState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | {
      kind: "success";
      summary: string;
      note: string;
      outcome: EnrolOutcome;
    };

export async function enrolRoster(
  _prev: EnrolState,
  formData: FormData,
): Promise<EnrolState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { kind: "error", message: "Only super admins can enrol people." };
  }

  const parsed = EnrolSchema.safeParse({
    cohort_id: formData.get("cohort_id"),
    emails: formData.get("emails"),
  });
  if (!parsed.success) {
    return { kind: "error", message: "Pick a cohort and paste some addresses." };
  }

  const { emails, rejected } = parseRoster(parsed.data.emails);
  if (emails.length === 0) {
    return {
      kind: "error",
      message:
        describeRejected(rejected) ||
        "No @wearephlo.com addresses found in that list.",
    };
  }

  const supabase = await createClient();

  const { data: cohort } = await supabase
    .from("programme_cohorts")
    .select("id, name, status, default_approver_user_id")
    .eq("id", parsed.data.cohort_id)
    .maybeSingle<{
      id: string;
      name: string;
      status: string;
      default_approver_user_id: string | null;
    }>();

  if (!cohort) return { kind: "error", message: "That cohort no longer exists." };
  if (cohort.status !== "planned" && cohort.status !== "live") {
    return {
      kind: "error",
      message: `${cohort.name} is ${cohort.status}. Only a planned or live cohort takes new members.`,
    };
  }

  // Everyone already in this cohort, and everyone already committed to another
  // active one. Read once rather than per address: a hundred-person roster
  // would otherwise be two hundred round trips.
  const { data: existing } = await supabase
    .from("programme_cohort_members")
    .select("user_id, cohort_id, programme_cohorts!inner(name, status)")
    .in("programme_cohorts.status", ["planned", "live"])
    .returns<
      {
        user_id: string;
        cohort_id: string;
        programme_cohorts: { name: string; status: string };
      }[]
    >();

  const inThisCohort = new Set(
    (existing ?? [])
      .filter((m) => m.cohort_id === cohort.id)
      .map((m) => m.user_id),
  );
  const inAnotherCohort = new Set(
    (existing ?? [])
      .filter((m) => m.cohort_id !== cohort.id)
      .map((m) => m.user_id),
  );

  const { data: pendingRows } = await supabase
    .from("programme_pending_enrolments")
    .select("email")
    .eq("cohort_id", cohort.id)
    .is("claimed_at", null)
    .returns<{ email: string }[]>();
  const alreadyPending = new Set((pendingRows ?? []).map((p) => p.email));

  // Team assignments, for defaulting the sign-off route from the org tree the
  // way the join code already does. A cohort's own default approver overrides
  // it entirely - that is what the field is for.
  const { data: peopleRows } = await supabase
    .from("people")
    .select("email, team")
    .returns<{ email: string; team: string | null }[]>();
  const teamByEmail = new Map(
    (peopleRows ?? []).map((p) => [p.email.toLowerCase(), p.team]),
  );

  const outcome = emptyOutcome();
  const pendingInserts: {
    cohort_id: string;
    email: string;
    team_lead_user_id: string | null;
    added_by: string;
  }[] = [];

  for (const email of emails) {
    const { data: resolved } = await supabase.rpc("user_id_for_email", {
      p_email: email,
    });
    const userId = typeof resolved === "string" ? resolved : null;

    let leadUserId = cohort.default_approver_user_id;
    if (!leadUserId) {
      const leadEmail = findLeadEmail(email, teamByEmail.get(email) ?? null);
      if (leadEmail && leadEmail !== email) {
        const { data: lead } = await supabase.rpc("user_id_for_email", {
          p_email: leadEmail,
        });
        if (typeof lead === "string") leadUserId = lead;
      }
    }

    if (!userId) {
      if (alreadyPending.has(email)) {
        outcome.alreadyIn.push(email);
        continue;
      }
      pendingInserts.push({
        cohort_id: cohort.id,
        email,
        team_lead_user_id: leadUserId,
        added_by: gate.user.id,
      });
      outcome.pending.push(email);
      continue;
    }

    if (inThisCohort.has(userId)) {
      outcome.alreadyIn.push(email);
      continue;
    }
    if (inAnotherCohort.has(userId)) {
      outcome.clashed.push(email);
      continue;
    }

    const { error } = await supabase.from("programme_cohort_members").insert({
      cohort_id: cohort.id,
      user_id: userId,
      // Never let the roster make somebody their own approver.
      team_lead_user_id: leadUserId === userId ? null : leadUserId,
    });

    if (error) {
      outcome.failed.push({ email, reason: error.message });
      continue;
    }
    // Guards the rest of this run against a duplicate further down the list.
    inThisCohort.add(userId);
    outcome.enrolled.push(email);
  }

  if (pendingInserts.length > 0) {
    const { error } = await supabase
      .from("programme_pending_enrolments")
      .upsert(pendingInserts, { onConflict: "cohort_id,email" });
    if (error) {
      return {
        kind: "error",
        message: `Enrolled ${outcome.enrolled.length}, but the pending list failed: ${error.message}`,
      };
    }
  }

  revalidatePath("/learn/admin");
  revalidatePath("/learn");
  revalidatePath("/learn/track");

  return {
    kind: "success",
    summary: summariseOutcome(outcome),
    note: describeRejected(rejected),
    outcome,
  };
}

/** Removes a pending enrolment that hasn't been claimed yet. */
export async function cancelPendingEnrolment(
  _prev: EnrolState,
  formData: FormData,
): Promise<EnrolState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { kind: "error", message: "Only super admins can change a roster." };
  }

  const id = z.string().uuid().safeParse(formData.get("pending_id"));
  if (!id.success) return { kind: "error", message: "Unknown enrolment." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("programme_pending_enrolments")
    .delete()
    .eq("id", id.data)
    .is("claimed_at", null);

  if (error) return { kind: "error", message: error.message };

  revalidatePath("/learn/admin");
  return {
    kind: "success",
    summary: "Pending enrolment removed.",
    note: "",
    outcome: emptyOutcome(),
  };
}
