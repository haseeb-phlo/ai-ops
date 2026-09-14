import Link from "next/link";
import { format } from "date-fns";
import { getSessionUser } from "@/lib/auth";
import { loadTrackState } from "@/lib/programme/track-data";
import { isAwaitingContent } from "@/lib/programme/content-readiness";
import { parseDayParam } from "@/lib/programme/day-link";
import { taskTakesLink } from "@/lib/programme/task-link";
import {
  hasDayArrived,
  unlockDateFor,
  weekOf,
} from "@/lib/programme/working-days";
import { PageContainer, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/eyebrow";
import { GraduationCapIcon } from "lucide-react";
import { BaselineGateCard } from "./_components/baseline-gate-card";
import { DayRow } from "./_components/day-row";
import { ProgrammeStatus } from "./_components/programme-status";
import { DayFocus } from "./_components/day-focus";
import { ActivityHeatmap } from "./_components/activity-heatmap";
import type { TrackItemView } from "./_components/track-item-card";
import type {
  ProgrammeItemState,
  ProgrammeSignoffStatus,
} from "@/lib/status";

export const metadata = { title: "Core Programme" };

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ cohort?: string; day?: string }>;
}) {
  const { cohort: cohortParam, day: dayParam } = await searchParams;
  const user = await getSessionUser();
  const state = await loadTrackState(user.id, user.email, cohortParam ?? null);

  if (!state) {
    return (
      <PageContainer>
        <PageHeader
          title="Core Programme"
          description="Phlo's 15-day AI training track."
        />
        <EmptyState
          icon={<GraduationCapIcon aria-hidden />}
          title="You're not in a cohort yet"
          description="The Core Programme runs in cohorts. You'll see your 15-day track here as soon as you're enrolled - in the meantime, everything in Learn is open to browse."
          action={
            <Link
              href="/learn"
              className="text-sm font-medium text-primary underline underline-offset-4"
            >
              Go to Learn
            </Link>
          }
        />
      </PageContainer>
    );
  }

  // Day 0 is the entry gate and renders as the gate card, not a timeline row.
  const dayItems = state.items.filter((r) => r.item.day_index > 0);

  const byDay = new Map<number, TrackItemView[]>();
  for (const resolved of dayItems) {
    const list = byDay.get(resolved.item.day_index) ?? [];
    list.push({
      id: resolved.item.id,
      type: resolved.item.type,
      title: resolved.item.title,
      description: resolved.item.description,
      state: resolved.state as ProgrammeItemState,
      unlockDate: resolved.unlockDate,
      awaitingVideo: isAwaitingContent(resolved.item),
      dayArrived: hasDayArrived({
        dayIndex: resolved.item.day_index,
        startDate: state.cohort.startDate,
        today: state.today,
      }),
      blockedByWeekOne:
        !state.weekOneGate.satisfied && weekOf(resolved.item.day_index) > 1,
      // Its date is today, so the thing still holding it is the 7am open
      // rather than a day that has not come round. Computed here, once, so
      // the card and the focus panel cannot word the same wait differently.
      //
      // The entry gate has to be open for that to be true. A member who has
      // not done the check-in sees this timeline - it is NOT behind the
      // `entryGateOpen` guard the panels above use - and every item on it is
      // locked by the gate rather than by the clock. Without this clause such
      // a member is told at 2pm to wait until 7am, an hour that went nine
      // hours ago. Week one's checkpoint is the same problem one week later
      // and is handled by `blockedByWeekOne`, which speaks first.
      opensToday: state.entryGateOpen && resolved.unlockDate === state.today,
      // Daily arithmetic, matching hasDayArrived - so the date the card
      // prints is exactly the date it starts showing the item.
      releaseDate: unlockDateFor(
        state.cohort.startDate,
        resolved.item.day_index,
        "daily",
      ),
      video: resolved.item.learn_video_id
        ? (state.videosById.get(resolved.item.learn_video_id) ?? null)
        : null,
      evidence: state.taskEvidenceByItemId.get(resolved.item.id) ?? null,
      // Which days take a link is one list, in task-link.ts, read here so the
      // card never learns a day number - the same reason `opensToday` is
      // computed above rather than in the component.
      acceptsLink: taskTakesLink(resolved.item.day_index),
      submission:
        resolved.item.type === "submission_slot"
          ? {
              kind:
                (resolved.item.config_json?.kind as string) ??
                "signed_example",
              signoffStatus:
                (state.submissionByItemId.get(resolved.item.id)
                  ?.signoffStatus as ProgrammeSignoffStatus) ?? null,
              signoffComment:
                state.submissionByItemId.get(resolved.item.id)
                  ?.signoffComment ?? null,
            }
          : null,
    });
    byDay.set(resolved.item.day_index, list);
  }

  const days = [...byDay.keys()].sort((a, b) => a - b);
  const unlockByDay = new Map(
    dayItems.map((r) => [r.item.day_index, r.unlockDate]),
  );

  // The soonest date anything still locked becomes available, so the panel can
  // say when to come back rather than leaving a wall of grey to interpret.
  const nextOpensOn =
    state.items
      .filter((r) => r.state === "locked")
      .map((r) => r.unlockDate)
      .sort()[0] ?? null;

  // Which day of the programme today is. Computed with DAILY arithmetic even
  // under weekly unlock: a whole week shares one unlock date, so comparing
  // against that would label all five days "Today".
  const todayDayIndex =
    days.find(
      (d) => unlockDateFor(state.cohort.startDate, d, "daily") === state.today,
    ) ?? null;

  // A day named in the URL wins over "today", so a link posted in Slack opens
  // the day it names. Validated rather than trusted - see parseDayParam.
  //
  // Nothing about unlock changes here. A day still to come renders as its
  // release date and nothing else, so a link posted early gives nothing away,
  // which is what makes it safe to schedule the whole fortnight of posts.
  const requestedDay = parseDayParam(dayParam, days);

  const weeks = [1, 2, 3]
    .map((week) => ({
      week,
      days: days.filter((d) => weekOf(d) === week),
    }))
    .filter((w) => w.days.length > 0);

  return (
    <PageContainer>
      <PageHeader
        title="Core Programme"
        // British format, not the ISO date the column stores. "2026-08-31" is
        // a database value shown to a person; "31 August 2026" is the date.
        //
        // The Prompt library link that used to sit here is gone deliberately:
        // it moved into the shared Learn nav upstream, and putting it back
        // would give the page two routes to the same place.
        description={`${state.cohort.name} · started ${format(
          new Date(`${state.cohort.startDate}T00:00:00`),
          "d MMMM yyyy",
        )}`}
      />

      {(state.cohort.status === "complete" ||
        state.cohort.status === "archived") && (
        <p className="rounded-md border border-border border-l-2 border-l-muted-foreground bg-background px-3 py-2 text-xs leading-normal text-foreground">
          This cohort has finished. Everything below is your record of it -
          nothing new will unlock.
        </p>
      )}

      {/* No preview-run banner, and no cross-link to one. A preview exists to
          show you the member's page; anything drawn onto it that a member
          would not see is the page lying to you about itself.

          The banner had also gone stale in a way that mattered - it promised
          the preview reached neither reporting nor notifications, and the
          preview now sends. The cohort's name is in the header above, which
          is how you tell which one you are looking at. */}

      {/* One card for "where am I": the headline, the four gates and every
          outstanding thing in one list. Four panels used to say this between
          them - a completion notice, the gates, the week-one checkpoint and a
          "ready for you" panel whose progress bar was gate one over again. */}
      {!state.entryGateOpen ? (
        <BaselineGateCard />
      ) : (
        <ProgrammeStatus
          gates={state.gates}
          rag={state.rag}
          g3Remaining={state.g3Remaining}
          openCount={state.outstandingCount}
          nextOpensOn={nextOpensOn}
          nextOpensToday={nextOpensOn === state.today}
          isComplete={state.membership.completedAt !== null}
          nextSteps={state.nextSteps}
          weekOneOutstanding={
            state.weekOneGate.satisfied ? [] : state.weekOneGate.outstanding
          }
        />
      )}

      {state.entryGateOpen && <ActivityHeatmap days={state.activity} />}

      {state.entryGateOpen && (
        <DayFocus
          cohortId={state.cohort.id}
          days={days.map((day) => ({
            dayIndex: day,
            unlockDate: unlockByDay.get(day) ?? state.cohort.startDate,
            opensToday: unlockByDay.get(day) === state.today,
            items: byDay.get(day) ?? [],
          }))}
          todayDayIndex={todayDayIndex}
          requestedDay={requestedDay}
          weekOfDay={Object.fromEntries(days.map((d) => [d, weekOf(d)]))}
        />
      )}

      {/* The full timeline stays below the focus card rather than being
          replaced by it. The card answers "what now"; this answers "what is
          the whole thing", which is the question anyone senior asks first and
          the one a carousel cannot answer at all. */}
      <div id="day-timeline" className="space-y-8">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          All {days.length} days
        </h2>
        {weeks.map(({ week, days: weekDays }) => (
          <section key={week} className="space-y-2">
            <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
              <Eyebrow as="h2">
                Week {week}
              </Eyebrow>
              <span className="font-mono text-3xs tabular-nums text-muted-foreground">
                {weekDays.filter((d) =>
                  (byDay.get(d) ?? []).every(
                    (i) => i.state === "complete" || i.awaitingVideo,
                  ),
                ).length}
                /{weekDays.length} days done
              </span>
            </div>
            <ol>
              {weekDays.map((day) => (
                <DayRow
                  key={day}
                  cohortId={state.cohort.id}
                  dayIndex={day}
                  unlockDate={unlockByDay.get(day) ?? state.cohort.startDate}
                  isToday={day === todayDayIndex}
                  items={byDay.get(day) ?? []}
                />
              ))}
            </ol>
          </section>
        ))}
      </div>
    </PageContainer>
  );
}
