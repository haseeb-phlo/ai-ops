import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadCohortAdminView } from "@/lib/programme/cohort-admin";
import { PageContainer, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { UsersIcon } from "lucide-react";
import fixture from "@/lib/programme/may-2026-distribution.json";
import { ImportPanel } from "./_components/import-panel";
import { ProgrammeTabs } from "./_components/programme-tabs";
import { RosterGrid } from "./_components/roster-grid";
import { CohortDashboard } from "./_components/cohort-dashboard";
import { CohortPicker } from "./_components/cohort-picker";

export const metadata = { title: "Programme admin" };

/**
 * Programme admin.
 *
 * Under /learn rather than as another tab on /admin: that page is already
 * ~500 lines, and everything here is programme-specific.
 */
export default async function ProgrammeAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; cohort?: string }>;
}) {
  const { cohort: cohortParam } = await searchParams;
  const user = await getSessionUser();
  if (user.realRole !== "super_admin") {
    redirect("/learn?toast=admin-only");
  }

  const supabase = await createClient();
  const [{ data: cohorts }, { count: mayCount }, { count: unlinkedCount }] =
    await Promise.all([
      supabase
        .from("programme_cohorts")
        .select("id, name, status, start_date, is_test")
        .order("start_date", { ascending: false })
        .returns<
          {
            id: string;
            name: string;
            status: string;
            start_date: string;
            is_test: boolean;
          }[]
        >(),
      supabase
        .from("ai_score_responses")
        .select("id", { count: "exact", head: true })
        .eq("wave", "may_2026"),
      supabase
        .from("ai_score_responses")
        .select("id", { count: "exact", head: true })
        .eq("wave", "may_2026")
        .is("user_id", null),
    ]);

  const cohortList = cohorts ?? [];
  // Default to the first live cohort, falling back to the most recent.
  const selectedId =
    cohortParam ??
    cohortList.find((c) => c.status === "live")?.id ??
    cohortList[0]?.id ??
    null;
  const view = selectedId ? await loadCohortAdminView(selectedId) : null;

  const noCohorts = (
    <EmptyState
      icon={<UsersIcon aria-hidden />}
      title="No cohort selected"
      description="Create a cohort to start tracking a group through the programme."
    />
  );

  return (
    <PageContainer className="max-w-7xl">
      <PageHeader
        title="Programme admin"
        description="Attendance, progress and the AI Score baseline."
        actions={
          <>
            {cohortList.length > 0 && (
              <CohortPicker cohorts={cohortList} selectedId={selectedId} />
            )}
            <Link
              href="/learn/track"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Member view
            </Link>
          </>
        }
      />

      <ProgrammeTabs
        dashboard={
          view ? (
            <CohortDashboard
              cohortId={view.cohort.id}
              members={view.members.map((m) => ({
                cohortMemberId: m.cohortMemberId,
                displayName: m.displayName,
                rag: m.rag,
                outstandingCount: m.outstandingCount,
                dayState: Object.fromEntries(m.dayState),
              }))}
              dayIndexes={view.dayIndexes}
              funnel={view.funnel}
              attendance={view.sessions.map((s) => {
                const summary = view.attendanceBySession.get(s.trackItemId)!;
                return {
                  title: s.title,
                  attended: summary.attended,
                  absent: summary.absent,
                  excused: summary.excused,
                  unmarked: summary.unmarked,
                };
              })}
            />
          ) : (
            noCohorts
          )
        }
        roster={
          view ? (
            view.members.length === 0 ? (
              <EmptyState
                icon={<UsersIcon aria-hidden />}
                title="No members in this cohort"
                description="Add people to the cohort to mark their attendance."
              />
            ) : (
              <RosterGrid
                cohortId={view.cohort.id}
                members={view.members.map((m) => ({
                  cohortMemberId: m.cohortMemberId,
                  userId: m.userId,
                  displayName: m.displayName,
                  attendance: Object.fromEntries(m.attendance),
                }))}
                sessions={view.sessions.map((s) => ({
                  trackItemId: s.trackItemId,
                  title: s.title,
                  slotDates: s.slotDates,
                }))}
              />
            )
          ) : (
            noCohorts
          )
        }
        cohorts={
          cohortList.length === 0 ? (
            noCohorts
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {cohortList.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
                >
                  <span className="text-sm font-medium text-foreground">
                    {c.name}
                    {c.is_test && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        test
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {c.status} · starts {c.start_date}
                  </span>
                </li>
              ))}
            </ul>
          )
        }
        importPanel={
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground tabular-nums">
              {mayCount ?? 0} May 2026 responses stored
              {(unlinkedCount ?? 0) > 0 &&
                ` · ${unlinkedCount} awaiting first sign-in`}
            </p>
            <ImportPanel
              expected={
                fixture.distributions as Record<string, Record<string, number>>
              }
            />
          </div>
        }
      />
    </PageContainer>
  );
}
