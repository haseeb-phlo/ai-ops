import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { loadTrackState } from "@/lib/programme/track-data";
import { PageContainer, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { GraduationCapIcon } from "lucide-react";
import { BaselineGateCard } from "./_components/baseline-gate-card";
import { GateStrip } from "./_components/gate-strip";
import { DayRow } from "./_components/day-row";
import type { TrackItemView } from "./_components/track-item-card";
import type { ProgrammeItemState } from "@/lib/status";

export const metadata = { title: "Core Programme" };

export default async function TrackPage() {
  const user = await getSessionUser();
  const state = await loadTrackState(user.id, user.email);

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
          description="The Core Programme runs in cohorts. You'll see your 15-day track here as soon as you're enrolled — in the meantime, everything in Learn is open to browse."
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
      video: resolved.item.learn_video_id
        ? (state.videosById.get(resolved.item.learn_video_id) ?? null)
        : null,
    });
    byDay.set(resolved.item.day_index, list);
  }

  const days = [...byDay.keys()].sort((a, b) => a - b);
  const unlockByDay = new Map(
    dayItems.map((r) => [r.item.day_index, r.unlockDate]),
  );

  const completedContent = state.gates.g1.current;
  const totalContent = state.gates.g1.target;

  return (
    <PageContainer>
      <PageHeader
        title="Core Programme"
        description={`${state.cohort.name} · started ${state.cohort.startDate}`}
        actions={
          <Link
            href="/learn"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" aria-hidden />
            All of Learn
          </Link>
        }
      />

      {!state.hasBaseline ? (
        <BaselineGateCard />
      ) : (
        <GateStrip gates={state.gates} rag={state.rag} />
      )}

      {state.hasBaseline && (
        <p className="text-sm text-muted-foreground">
          {completedContent} of {totalContent} daily items complete.
          {state.outstandingCount > 0 &&
            ` ${state.outstandingCount} open right now.`}
        </p>
      )}

      <ol className="mt-2">
        {days.map((day) => (
          <DayRow
            key={day}
            dayIndex={day}
            unlockDate={unlockByDay.get(day) ?? state.cohort.startDate}
            isToday={unlockByDay.get(day) === state.today}
            items={byDay.get(day) ?? []}
          />
        ))}
      </ol>
    </PageContainer>
  );
}
