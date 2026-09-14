import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  dayAwaitsContent,
  daySpine,
  dayStatus,
} from "@/lib/programme/day-status";
import { TrackItemCard, type TrackItemView } from "./track-item-card";

/**
 * One day of the timeline: a sticky-ish left rail with the day number and
 * date, and the day's items to the right.
 *
 * Today gets a filled marker and a ring; past and future days differ only in
 * opacity, which the item cards already carry.
 */
export function DayRow({
  cohortId,
  dayIndex,
  unlockDate,
  isToday,
  items,
}: {
  /** Which cohort these items belong to, so a write lands on the right one. */
  cohortId: string;
  dayIndex: number;
  unlockDate: string;
  isToday: boolean;
  items: TrackItemView[];
}) {
  // One rule for what a day is doing, shared with the focus card - see
  // day-status.ts for why it is not derived here.
  const status = dayStatus(items, isToday);
  const allLocked = status === "locked";
  const allComplete = status === "complete";

  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {/* The connecting spine, carrying two facts downward: colour is the
          member's progress, a dash is a day we still owe a recording. */}
      <div
        aria-hidden
        className={cn(
          "absolute bottom-0 left-[15px] top-8 border-l",
          daySpine(status, dayAwaitsContent(items)),
        )}
      />

      <div className="relative z-10 flex w-8 shrink-0 flex-col items-center">
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
            isToday
              ? "border-primary bg-primary text-primary-foreground ring-4 ring-secondary"
              : allComplete
                ? "border-border bg-background"
                : allLocked
                  ? "border-border bg-muted text-muted-foreground/60"
                  : "border-border bg-background text-foreground",
          )}
        >
          {dayIndex}
        </span>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-baseline gap-2 pt-1">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Day {dayIndex}
          </h3>
          <span className="text-xs text-muted-foreground/70">
            {format(new Date(`${unlockDate}T00:00:00`), "EEE d MMM")}
          </span>
          {isToday && (
            <span className="rounded bg-secondary px-1.5 py-0.5 text-3xs font-medium uppercase tracking-eyebrow text-secondary-foreground">
              Today
            </span>
          )}
        </div>
        {items.map((item) => (
          <TrackItemCard key={item.id} cohortId={cohortId} item={item} />
        ))}
      </div>
    </li>
  );
}
