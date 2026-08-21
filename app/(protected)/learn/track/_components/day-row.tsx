import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { TrackItemCard, type TrackItemView } from "./track-item-card";

/**
 * One day of the timeline: a sticky-ish left rail with the day number and
 * date, and the day's items to the right.
 *
 * Today gets a filled marker and a ring; past and future days differ only in
 * opacity, which the item cards already carry.
 */
export function DayRow({
  dayIndex,
  unlockDate,
  isToday,
  items,
}: {
  dayIndex: number;
  unlockDate: string;
  isToday: boolean;
  items: TrackItemView[];
}) {
  const allLocked = items.every((i) => i.state === "locked");
  // A day whose video is still being recorded is not "done" - it is waiting on
  // us. Marking it green would tell the member they had finished something
  // they have not actually been able to do.
  const actionable = items.filter((i) => !i.awaitingVideo);
  const allComplete =
    actionable.length > 0 && actionable.every((i) => i.state === "complete");

  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {/* The connecting spine. */}
      <div
        aria-hidden
        className="absolute bottom-0 left-[15px] top-8 w-px bg-border"
      />

      <div className="relative z-10 flex w-8 shrink-0 flex-col items-center">
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
            isToday
              ? "border-primary bg-primary text-primary-foreground ring-4 ring-secondary"
              : allComplete
                ? "border-border bg-emerald-50 text-emerald-700"
                : allLocked
                  ? "border-border bg-muted text-muted-foreground/60"
                  : "border-border bg-card text-foreground",
          )}
        >
          {dayIndex}
        </span>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-baseline gap-2 pt-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Day {dayIndex}
          </h3>
          <span className="text-xs text-muted-foreground/70">
            {format(new Date(`${unlockDate}T00:00:00`), "EEE d MMM")}
          </span>
          {isToday && (
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">
              Today
            </span>
          )}
        </div>
        {items.map((item) => (
          <TrackItemCard key={item.id} item={item} />
        ))}
      </div>
    </li>
  );
}
