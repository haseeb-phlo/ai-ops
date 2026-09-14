import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadCohortAdminView } from "@/lib/programme/cohort-admin";
import { PageContainer, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardCheckIcon, UsersIcon } from "lucide-react";
import fixture from "@/lib/programme/may-2026-distribution.json";
import { ImportPanel } from "./_components/import-panel";
import { ProgrammeTabs } from "./_components/programme-tabs";
import { RosterGrid } from "./_components/roster-grid";
import { EnrolPanel } from "./_components/enrol-panel";
import { CohortDashboard } from "./_components/cohort-dashboard";
import { CohortPicker } from "./_components/cohort-picker";
import { CohortManager } from "./_components/cohort-manager";
import { ReportingPanel } from "./_components/reporting-panel";
import { QuizResultsPanel } from "./_components/quiz-results-panel";
import { PreviewPanel } from "./_components/preview-panel";
import { ReviewEvalPanel } from "./_components/review-eval-panel";
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
import { claudeStatus } from "@/lib/anthropic";
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
  const [
    { data: cohorts },
    { count: mayCount },
    { count: unlinkedCount },
    { count: reviewErrorCount },
    { count: awaitingReviewCount },
  ] = await Promise.all([
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
      // The automatic reviewer fails CLOSED - a missing API key, a wrong
      // model name and a model outage all leave the submission pending for a
      // person. That is the safe direction, and it is also indistinguishable
      // from "the queue is busy" unless somebody counts it. So it is counted.
      supabase
        .from("programme_submissions")
        .select("id", { count: "exact", head: true })
        .eq("ai_decision", "error"),
      supabase
        .from("programme_submissions")
        .select("id", { count: "exact", head: true })
        .eq("signoff_status", "pending")
        .is("ai_reviewed_at", null)
        .is("superseded_by", null),
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
  const accountHolders = await loadImpersonableUsers();
  const approvers = accountHolders
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

  const memberCountByCohort = new Map<string, number>();
  for (const m of memberRows ?? []) {
    memberCountByCohort.set(
      m.cohort_id,
      (memberCountByCohort.get(m.cohort_id) ?? 0) + 1,
    );
  }
  // Who is enrolable. `people` is the org list (138 rows); only 75 of them
  // have ever signed in, so the panel works from addresses throughout and
  // lets the claim RPC bind the rest when they arrive.
  const [{ data: orgPeople }, { data: activeMemberRows }] = await Promise.all([
    supabase
      .from("people")
      .select("email")
      .order("email")
      .returns<{ email: string }[]>(),
    supabase
      .from("programme_cohort_members")
      .select("user_id, programme_cohorts!inner(status)")
      .in("programme_cohorts.status", ["planned", "live"])
      .returns<{ user_id: string }[]>(),
  ]);

  const emailByUserId = new Map(
    accountHolders.map((u) => [u.userId, u.email.toLowerCase()]),
  );
  const committedEmails = new Set(
    (activeMemberRows ?? [])
      .map((m) => emailByUserId.get(m.user_id))
      .filter((e): e is string => Boolean(e)),
  );

  // Default to the first live REAL cohort, falling back to any live one and
  // then to the most recent.
  //
  // The is_test check is what makes this useful: a super admin's own preview
  // run is permanently live, so once real cohorts went live too, "first live
  // cohort" could land the admin on their sandbox - and every count, roster
  // and sign-off queue on the page would quietly be the sandbox's.
  const selectedId =
    cohortParam ??
    cohortList.find((c) => c.status === "live" && !c.is_test)?.id ??
    cohortList.find((c) => c.status === "live")?.id ??
    cohortList[0]?.id ??
    null;
  const view = selectedId ? await loadCohortAdminView(selectedId) : null;

  const { data: pendingRows } = selectedId
    ? await supabase
        .from("programme_pending_enrolments")
        .select("id, email, created_at")
        .eq("cohort_id", selectedId)
        .is("claimed_at", null)
        .order("email")
        .returns<{ id: string; email: string; created_at: string }[]>()
    : { data: [] as { id: string; email: string; created_at: string }[] };

  const pendingEmails = new Set((pendingRows ?? []).map((p) => p.email));
  const notEnrolledEmails = (orgPeople ?? [])
    .map((p) => p.email.toLowerCase())
    .filter((e) => !committedEmails.has(e) && !pendingEmails.has(e));

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
          cohortList.length > 0 ? (
            <CohortPicker cohorts={cohortList} selectedId={selectedId} />
          ) : undefined
        }
      />

      {/* The automatic reviewer failing is invisible by design - every error
          path leaves the submission for a person, which looks exactly like a
          busy queue. This is the only place that difference shows. */}
      {((reviewErrorCount ?? 0) > 0 || (awaitingReviewCount ?? 0) > 0) && (
        <p className="rounded-md border border-border border-l-2 border-l-warning bg-background px-3 py-2 text-xs leading-normal text-foreground">
          {(reviewErrorCount ?? 0) > 0 && (
            <>
              {reviewErrorCount} submission
              {reviewErrorCount === 1 ? "" : "s"} could not be reviewed
              automatically and {reviewErrorCount === 1 ? "is" : "are"} waiting
              for a person. Check ANTHROPIC_API_KEY is set.{" "}
            </>
          )}
          {(awaitingReviewCount ?? 0) > 0 && (
            <>
              {awaitingReviewCount} not reviewed yet - the nightly sweep picks
              these up.
            </>
          )}
        </p>
      )}

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
              workSamples={view.workSamples}
              taskLinks={view.taskLinks}
              taskDayIndexes={view.taskDayIndexes}
              dayLinks={view.dayLinks}
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
            <div className="space-y-6">
              <EnrolPanel
                cohortId={view.cohort.id}
                cohortName={view.cohort.name}
                cohortStatus={view.cohort.status}
                notEnrolledEmails={notEnrolledEmails}
                pending={(pendingRows ?? []).map((p) => ({
                  id: p.id,
                  email: p.email,
                  addedAt: p.created_at,
                }))}
              />
              {view.members.length === 0 ? (
              <EmptyState
                icon={<UsersIcon aria-hidden />}
                title="No members in this cohort"
                description="Enrol people above, then come back here to mark their attendance."
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
              )}
            </div>
          ) : (
            noCohorts
          )
        }
        quizzes={
          view ? (
            view.members.length === 0 ? (
              <EmptyState
                icon={<ClipboardCheckIcon aria-hidden />}
                title="No members in this cohort"
                description="Enrol people on the Roster tab, then their quiz scores show up here."
              />
            ) : (
              <QuizResultsPanel
                cohortName={view.cohort.name}
                cohortStatus={view.cohort.status}
                columns={view.quizColumns}
                rows={view.quizResults}
                summaries={view.quizSummaries}
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
            <ReviewEvalPanel configuration={claudeStatus()} />
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
            <p className="text-xs leading-normal text-muted-foreground tabular-nums">
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
