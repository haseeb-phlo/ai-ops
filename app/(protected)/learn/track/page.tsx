import Link from "next/link";
import { format } from "date-fns";
import { getSessionUser } from "@/lib/auth";
import { loadTrackState } from "@/lib/programme/track-data";
import { isAwaitingContent } from "@/lib/programme/content-readiness";
import {
  hasDayArrived,
  unlockDateFor,
  weekOf,
} from "@/lib/programme/working-days";
import { PageContainer, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { GraduationCapIcon } from "lucide-react";
import { BaselineGateCard } from "./_components/baseline-gate-card";
import { GateStrip } from "./_components/gate-strip";
import { DayRow } from "./_components/day-row";
import { TodayPanel } from "./_components/today-panel";
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
  searchParams: Promise<{ cohort?: string }>;
}) {
  const { cohort: cohortParam } = await searchParams;
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
      // Its date is today, so the thing still holding it is the 9am open
      // rather than a day that has not come round. Computed here, once, so
      // the card and the focus panel cannot word the same wait differently.
      opensToday: resolved.unlockDate === state.today,
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
      outputUrl: state.taskLinkByItemId.get(resolved.item.id) ?? null,
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


  const completedContent = state.gates.g1.current;

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

  const weeks = [1, 2, 3]
    .map((week) => ({
      week,
      days: days.filter((d) => weekOf(d) === week),
    }))
    .filter((w) => w.days.length > 0);
  const totalContent = state.gates.g1.target;

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
        <p className="rounded-md border border-border border-l-2 border-l-muted-foreground bg-background px-3 py-2 text-xs text-foreground">
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

      {!state.entryGateOpen ? (
        <BaselineGateCard />
      ) : (
        <>
          {/* One card, keyed on the completion latch. There is no approval
              step to wait on any more, so there is no in-between state. */}
          {state.membership.completedAt && (
            <div className="rounded-lg border border-border bg-secondary px-5 py-4 text-secondary-foreground">
              <p className="text-sm font-semibold tracking-tight">
                You&apos;ve completed the Core Programme
              </p>
              <p className="mt-0.5 text-xs text-secondary-foreground/80">
                All four gates passed. Everything stays here if you want to go
                back over it.
              </p>
            </div>
          )}
          <GateStrip
            gates={state.gates}
            rag={state.rag}
            g3Routes={state.g3Routes}
          />
        </>
      )}

      {/* Week one's checkpoint, said up front rather than at the wall.
          Without this the first sign of it is week two failing to open on
          the Monday, by which point the "before" sample it is asking for has
          stopped being a before. Shown from day one, and only while
          something is actually outstanding. */}
      {state.entryGateOpen && !state.weekOneGate.satisfied && (
        <div className="rounded-md border border-border border-l-2 border-l-warning bg-background px-4 py-3">
          <p className="text-sm font-medium text-foreground">
            {state.weekOneGate.outstanding.length === 1
              ? "One thing to submit before week 2 opens"
              : `${state.weekOneGate.outstanding.length} things to submit before week 2 opens`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Week 2 stays shut until{" "}
            {state.weekOneGate.outstanding
              .map((i) => `${i.title} (day ${i.dayIndex})`)
              .join(" and ")}{" "}
            {state.weekOneGate.outstanding.length === 1 ? "is" : "are"} in. You
            do not need them signed off - submitting is enough.
          </p>
        </div>
      )}

      {state.entryGateOpen && (
        <TodayPanel
          openCount={state.outstandingCount}
          nextOpensOn={nextOpensOn}
          nextOpensToday={nextOpensOn === state.today}
          completedCount={completedContent}
          totalCount={totalContent}
          isComplete={state.membership.completedAt !== null}
          nextSteps={state.nextSteps}
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
              <h2 className="text-3xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Week {week}
              </h2>
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
