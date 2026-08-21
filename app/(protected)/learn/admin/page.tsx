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
import { CohortManager } from "./_components/cohort-manager";
import { CertificateQueue } from "./_components/certificate-queue";
import { ReportingPanel } from "./_components/reporting-panel";
import { PreviewPanel } from "./_components/preview-panel";
import {
  filterRows,
  loadReportingData,
} from "@/lib/programme/reporting-data";
import {
  bandMigration,
  capabilityMix,
  completionTelemetry,
  confidenceShift,
  driftComparison,
  hoursSaved,
  returnerTripwireTripped,
} from "@/lib/programme/reporting";
import { slackEnabled } from "@/lib/slack";
import { loadImpersonableUsers } from "@/lib/impersonable-users";
import { todayInLondon } from "@/lib/programme/working-days";

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
  searchParams: Promise<{
    tab?: string;
    cohort?: string;
    fn?: string;
    rehearsal?: string;
  }>;
}) {
  const {
    cohort: cohortParam,
    fn: functionParam,
    rehearsal: rehearsalParam,
  } = await searchParams;
  const includeRehearsal = rehearsalParam === "1";
  const user = await getSessionUser();
  if (user.realRole !== "super_admin") {
    redirect("/learn?toast=admin-only");
  }

  const supabase = await createClient();
  const [{ data: cohorts }, { count: mayCount }, { count: unlinkedCount }] =
    await Promise.all([
      supabase
        .from("programme_cohorts")
        .select(
          "id, name, status, start_date, is_test, join_code, join_open, slack_channel, default_approver_user_id, review_mode",
        )
        .order("start_date", { ascending: false })
        .returns<
          {
            id: string;
            name: string;
            status: string;
            start_date: string;
            is_test: boolean;
            join_code: string | null;
            join_open: boolean;
            slack_channel: string | null;
            default_approver_user_id: string | null;
            review_mode: string;
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

  // The create form needs the track's session items so it can derive dates,
  // and the list shows how many people have enrolled on each cohort.
  const [{ data: sessionRows }, { data: memberRows }] = await Promise.all([
    supabase
      .from("programme_track_items")
      .select("id, title, day_index, programme_tracks!inner(slug)")
      .eq("type", "session")
      .eq("programme_tracks.slug", "core-programme")
      .order("day_index")
      .returns<{ id: string; title: string; day_index: number }[]>(),
    supabase
      .from("programme_cohort_members")
      .select("cohort_id")
      .returns<{ cohort_id: string }[]>(),
  ]);
  const sessionItems = sessionRows ?? [];

  // Who can be named as a cohort's approver. Anyone with an account: the
  // approver is a job, not a role, and for the first cohorts it is whoever
  // owns the programme rather than whoever the org tree points at.
  const approvers = (await loadImpersonableUsers())
    .map((u) => ({ userId: u.userId, displayName: u.displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  // Does this admin already have a preview run open?
  const { data: previewRow } = await supabase
    .from("programme_cohort_members")
    .select("id, cohort_id, programme_cohorts!inner(name, is_test)")
    .eq("user_id", user.id)
    .eq("programme_cohorts.is_test", true)
    .ilike("programme_cohorts.name", "Preview run - %")
    .maybeSingle<{ id: string; cohort_id: string }>();

  // Everyone who has met all four gates but has no certificate yet.
  const { data: certificateCandidates } = await supabase
    .from("programme_cohort_members")
    .select(
      "id, user_id, completed_at, certificate_declined_at, programme_cohorts!inner(name)",
    )
    .not("completed_at", "is", null)
    .is("certificate_issued_at", null)
    .order("completed_at", { ascending: true })
    .returns<
      {
        id: string;
        user_id: string;
        completed_at: string | null;
        certificate_declined_at: string | null;
        programme_cohorts: { name: string };
      }[]
    >();

  const { data: candidateProfiles } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", (certificateCandidates ?? []).map((c) => c.user_id))
    .returns<{ user_id: string; display_name: string | null }[]>();
  const nameByUserId = new Map(
    (candidateProfiles ?? []).map((p) => [p.user_id, p.display_name ?? ""]),
  );
  const memberCountByCohort = new Map<string, number>();
  for (const m of memberRows ?? []) {
    memberCountByCohort.set(
      m.cohort_id,
      (memberCountByCohort.get(m.cohort_id) ?? 0) + 1,
    );
  }
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

  // ---- Reporting ------------------------------------------------------
  const reporting = await loadReportingData(includeRehearsal);
  const reportingFilters = {
    cohortId: cohortParam ?? null,
    functionName: functionParam ?? null,
  };
  const scoped = filterRows(reporting.rows, reportingFilters);
  const baselineRows = scoped.filter((r) => r.wave === "cohort_baseline");
  const postRows = scoped.filter((r) => r.wave === "post");
  const telemetry = completionTelemetry(scoped);

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
          <div className="space-y-6">
            <PreviewPanel
              hasPreview={previewRow !== null}
              previewCohortId={previewRow?.cohort_id ?? null}
            />
            <CohortManager
            today={todayInLondon()}
            meUserId={user.id}
            approvers={approvers}
            sessions={sessionItems.map((i) => ({
              trackItemId: i.id,
              title: i.title,
              dayIndex: i.day_index,
            }))}
            cohorts={cohortList.map((c) => ({
              id: c.id,
              name: c.name,
              status: c.status,
              startDate: c.start_date,
              isTest: c.is_test,
              joinCode: c.join_code,
              joinOpen: c.join_open,
              slackChannel: c.slack_channel,
              defaultApproverUserId: c.default_approver_user_id,
              reviewMode: c.review_mode,
              memberCount: memberCountByCohort.get(c.id) ?? 0,
            }))}
            />
          </div>
        }
        certificates={
          <CertificateQueue
            slackConfigured={slackEnabled}
            candidates={(certificateCandidates ?? []).map((c) => ({
              cohortMemberId: c.id,
              displayName:
                nameByUserId.get(c.user_id) || "(no name)",
              cohortName: c.programme_cohorts.name,
              completedAt: c.completed_at!,
              declined: c.certificate_declined_at !== null,
            }))}
          />
        }
        reporting={
          <ReportingPanel
            filters={reportingFilters}
            includingRehearsal={includeRehearsal}
            view={{
              drift: driftComparison(scoped),
              capability: capabilityMix(baselineRows, postRows),
              confidence: confidenceShift(baselineRows, postRows),
              bands: bandMigration(baselineRows, postRows),
              telemetry,
              hours: hoursSaved(postRows.length > 0 ? postRows : baselineRows),
              tripwire: returnerTripwireTripped(telemetry),
              unmapped: reporting.unmapped,
              respondents: {
                before: baselineRows.length,
                after: postRows.length,
              },
              beforeLabel: "Cohort start",
              afterLabel: "Day 15",
            }}
          />
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
