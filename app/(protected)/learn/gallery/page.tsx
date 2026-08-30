import Link from "next/link";
import { redirect } from "next/navigation";
import { SparklesIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { loadTrackState } from "@/lib/programme/track-data";
import { learnAccess, canManageLibrary } from "@/lib/programme/learn-access";
import { resolveDisplayName } from "@/lib/profile";
import { PageContainer, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { GalleryFilters } from "./_components/filters";
import { PromptCard, type GalleryEntry } from "./_components/prompt-card";

export const metadata = { title: "Prompt library" };

/**
 * The company prompt library: every approved, publicly-shared submission from
 * every cohort.
 *
 * Visibility is enforced by RLS (approved + public_gallery is the one
 * company-wide read policy on programme_submissions), and the query repeats
 * the filter so the intent is readable here rather than only in the migration.
 */
export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ cohort?: string; team?: string; kind?: string }>;
}) {
  const filters = await searchParams;
  const user = await getSessionUser();

  // Gated with the rest of Learn. The gallery is other people's programme work,
  // so it belongs to the people doing the programme; showing it to someone
  // still waiting for their cohort is the open-library problem again, one
  // surface along. /learn explains what to do about it.
  const track = await loadTrackState(user.id, user.email);
  const access = learnAccess({
    inCohort: track !== null,
    entryGateOpen: track?.entryGateOpen ?? false,
  });
  if (access !== "open" && !canManageLibrary(user.realRole)) redirect("/learn");

  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("programme_submissions")
    .select(
      "id, kind, prompt_text, task_solved, time_saved_estimate, artefact_url, cohort_member_id",
    )
    .eq("signoff_status", "approved")
    .eq("visibility", "public_gallery")
    .order("created_at", { ascending: false })
    .returns<
      {
        id: string;
        kind: string;
        prompt_text: string | null;
        task_solved: string | null;
        time_saved_estimate: string | null;
        artefact_url: string | null;
        cohort_member_id: string;
      }[]
    >();

  const submissions = rows ?? [];

  // Author + cohort come from a second pass: the gallery read policy exposes
  // the submission, not the membership behind it, so this uses only ids the
  // caller can already see.
  const memberIds = [...new Set(submissions.map((s) => s.cohort_member_id))];
  const [{ data: members }, { data: profiles }, { data: people }] =
    await Promise.all([
      memberIds.length
        ? supabase
            .from("programme_cohort_members")
            .select(
              "id, user_id, is_champion, programme_cohorts!inner(name)",
            )
            .in("id", memberIds)
            .returns<
              {
                id: string;
                user_id: string;
                is_champion: boolean;
                programme_cohorts: { name: string };
              }[]
            >()
        : Promise.resolve({ data: [] as never[] }),
      supabase
        .from("profiles")
        .select("user_id, display_name")
        .returns<{ user_id: string; display_name: string | null }[]>(),
      supabase
        .from("people")
        .select("email, display_name, team")
        .returns<{ email: string; display_name: string; team: string }[]>(),
    ]);

  const memberById = new Map((members ?? []).map((m) => [m.id, m]));
  const profileByUserId = new Map(
    (profiles ?? []).map((p) => [p.user_id, p.display_name]),
  );
  const peopleByName = new Map(
    (people ?? []).map((p) => [p.display_name, p.team]),
  );

  const entries: GalleryEntry[] = submissions.flatMap((s) => {
    const member = memberById.get(s.cohort_member_id);
    if (!member) return [];
    const authorName = resolveDisplayName(
      profileByUserId.get(member.user_id),
      null,
      "",
    );
    return [
      {
        id: s.id,
        promptText: s.prompt_text,
        taskSolved: s.task_solved,
        timeSaved: s.time_saved_estimate,
        artefactUrl: s.artefact_url,
        authorName: authorName || "A colleague",
        isChampion: member.is_champion,
        cohortName: member.programme_cohorts.name,
        team: peopleByName.get(authorName) ?? null,
      },
    ];
  });

  const cohorts = [...new Set(entries.map((e) => e.cohortName))].sort();
  const teams = [
    ...new Set(entries.map((e) => e.team).filter((t): t is string => !!t)),
  ].sort();

  const visible = entries.filter(
    (e) =>
      (!filters.cohort || e.cohortName === filters.cohort) &&
      (!filters.team || e.team === filters.team),
  );

  return (
    <PageContainer>
      <PageHeader
        title="Prompt library"
        description="Prompts from across Phlo that a team lead has signed off as genuinely useful. Copy one and make it yours."
        actions={
          <Link
            href="/learn"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to Learn
          </Link>
        }
      />

      {entries.length > 0 && (
        <GalleryFilters
          cohorts={cohorts}
          teams={teams}
          activeCohort={filters.cohort ?? null}
          activeTeam={filters.team ?? null}
        />
      )}

      {visible.length === 0 ? (
        <EmptyState
          icon={<SparklesIcon aria-hidden />}
          title={
            entries.length === 0
              ? "No prompts shared yet"
              : "Nothing matches those filters"
          }
          description={
            entries.length === 0
              ? "As people complete the Core Programme and their leads sign off their work, the best prompts land here."
              : "Try clearing a filter."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((entry) => (
            <PromptCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
