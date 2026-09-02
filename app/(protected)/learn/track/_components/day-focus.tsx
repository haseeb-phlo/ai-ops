"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, LockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { dayStatus, type DayStatus } from "@/lib/programme/day-status";
import { PROGRAMME_OPEN_LABEL } from "@/lib/programme/working-days";
import { Button } from "@/components/ui/button";
import { TrackItemCard, type TrackItemView } from "./track-item-card";

/**
 * One day, large, with the whole programme still visible underneath.
 *
 * WHY NOT A PLAIN CAROUSEL. A carousel gives you focus and takes away the
 * shape: one card on screen and no way to see that you are six days into
 * fifteen, that week one is behind you, or that the next thing opens on
 * Wednesday. In a mandatory programme the shape is the motivation, and it is
 * also the first thing anyone senior asks - "what am I signing up for". So
 * the arrows are here, and so is the map: a rail of one dot per day, which is
 * this codebase's sanctioned way to show status anyway.
 *
 * The rail is not decoration. Every dot is a button, so jumping to day 12 is
 * one click rather than six taps of an arrow, and the left and right keys
 * work on the whole region.
 *
 * Nothing here changes what is unlocked. It is the same items, in the same
 * states, from the same resolver - only the framing is different.
 */

export type FocusDay = {
  dayIndex: number;
  unlockDate: string;
  /** Its unlock date is today and it is the 9am clock still holding it shut. */
  opensToday: boolean;
  items: TrackItemView[];
};

const statusOf = (day: FocusDay, isToday: boolean): DayStatus =>
  dayStatus(day.items, isToday);

const DOT: Record<DayStatus, string> = {
  complete: "bg-success",
  current: "bg-primary",
  open: "bg-transparent border border-muted-foreground/50",
  locked: "bg-transparent border border-border",
  awaiting: "bg-muted-foreground/30",
};

const DOT_LABEL: Record<DayStatus, string> = {
  complete: "done",
  current: "today",
  open: "open, not done",
  locked: "locked",
  awaiting: "waiting on content",
};

export function DayFocus({
  cohortId,
  days,
  todayDayIndex,
  weekOfDay,
}: {
  /** Which cohort these items belong to, so a write lands on the right one. */
  cohortId: string;
  days: FocusDay[];
  todayDayIndex: number | null;
  /** Passed in rather than imported so the week rule stays in one module. */
  weekOfDay: Record<number, number>;
}) {
  /**
   * Where to land someone.
   *
   * Today if today is a programme day. Otherwise the earliest day they can
   * still act on, because that is the thing they came to do - not day one,
   * which they finished a fortnight ago.
   */
  const initial = useMemo(() => {
    if (todayDayIndex && days.some((d) => d.dayIndex === todayDayIndex)) {
      return todayDayIndex;
    }
    const firstOpen = days.find(
      (d) => statusOf(d, false) === "open" || statusOf(d, false) === "current",
    );
    return firstOpen?.dayIndex ?? days[0]?.dayIndex ?? 1;
  }, [days, todayDayIndex]);

  const [selected, setSelected] = useState(initial);

  const index = days.findIndex((d) => d.dayIndex === selected);
  const day = days[index] ?? days[0];

  const go = useCallback(
    (delta: number) => {
      setSelected((current) => {
        const at = days.findIndex((d) => d.dayIndex === current);
        const next = days[at + delta];
        return next ? next.dayIndex : current;
      });
    },
    [days],
  );

  // Left and right anywhere in the region, as long as you are not typing.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (!day) return null;

  const status = statusOf(day, day.dayIndex === todayDayIndex);
  const locked = status === "locked";
  const weeks = [1, 2, 3]
    .map((week) => ({
      week,
      days: days.filter((d) => weekOfDay[d.dayIndex] === week),
    }))
    .filter((w) => w.days.length > 0);

  return (
    <section aria-label="Your day" className="space-y-3">
      <div className="rounded-lg border border-border bg-background p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Day {day.dayIndex}
            </h2>
            {day.dayIndex === todayDayIndex && (
              <span className="flex items-center gap-1.5 text-3xs font-semibold uppercase tracking-[0.06em] text-foreground">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                Today
              </span>
            )}
            {locked && (
              <span className="flex items-center gap-1 text-3xs uppercase tracking-[0.06em] text-muted-foreground">
                <LockIcon className="size-3" aria-hidden />
                opens{" "}
                {day.opensToday
                  ? PROGRAMME_OPEN_LABEL
                  : format(new Date(day.unlockDate), "EEE d MMM")}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => go(-1)}
              disabled={index <= 0}
              aria-label="Previous day"
            >
              <ChevronLeftIcon aria-hidden />
            </Button>
            <span className="font-mono text-3xs tabular-nums text-muted-foreground">
              {index + 1}/{days.length}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => go(1)}
              disabled={index >= days.length - 1}
              aria-label="Next day"
            >
              <ChevronRightIcon aria-hidden />
            </Button>
          </div>
        </div>

        {/* Announced rather than silent: moving between days changes the whole
            panel, which a screen reader would otherwise not mention. */}
        <div aria-live="polite" className="mt-3 space-y-2">
          {day.items.map((item) => (
            <TrackItemCard key={item.id} cohortId={cohortId} item={item} />
          ))}
        </div>
      </div>

      {/* The map. One dot per day, grouped by the week people actually
          experience, with the gate strip sitting above it on the page. */}
      <nav
        aria-label="Jump to a day"
        className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1"
      >
        {weeks.map(({ week, days: weekDays }) => (
          <div key={week} className="flex items-center gap-2">
            <span className="font-mono text-3xs uppercase tracking-[0.06em] text-muted-foreground">
              W{week}
            </span>
            <div className="flex items-center gap-1.5">
              {weekDays.map((d) => {
                const dayStatus = statusOf(d, d.dayIndex === todayDayIndex);
                const isSelected = d.dayIndex === day.dayIndex;
                return (
                  <button
                    key={d.dayIndex}
                    type="button"
                    onClick={() => setSelected(d.dayIndex)}
                    aria-current={isSelected ? "true" : undefined}
                    aria-label={`Day ${d.dayIndex}, ${DOT_LABEL[dayStatus]}`}
                    title={`Day ${d.dayIndex} - ${DOT_LABEL[dayStatus]}`}
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full transition",
                      "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary",
                      isSelected && "bg-secondary",
                    )}
                  >
                    <span
                      className={cn("size-1.5 rounded-full", DOT[dayStatus])}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </section>
  );
}
