import { cn } from "@/lib/utils";
import {
  activityStep,
  cohortMix,
  describeDay,
  rampWash,
  youMix,
  type DayActivity,
} from "@/lib/programme/activity";

/**
 * Fifteen days at a glance, with the cohort behind you.
 *
 * The rationale for washing a surface at all, and for the two layers being
 * composited rather than stacked, is in activity.ts. What matters here is that
 * no cell carries its meaning in colour alone: every one of them holds a
 * sentence for a screen reader and the same sentence as its tooltip, because a
 * heatmap that is only a colour is unreadable to anyone who cannot see it.
 */
export function ActivityHeatmap({ days }: { days: DayActivity[] }) {
  if (days.length === 0) return null;

  const hasCohort = days.some((d) => d.cohort !== null);
  const weeks = [1, 2, 3].map((week) => ({
    week,
    days: days.filter((d) => Math.ceil(d.dayIndex / 5) === week),
  }));

  return (
    <section className="rounded-lg border border-border bg-background p-4 sm:p-5">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">
        Your fifteen days
      </h2>

      <div className="mt-4 flex flex-wrap items-start gap-x-6 gap-y-4">
        {weeks.map(({ week, days: weekDays }) => (
          <div key={week}>
            <p className="font-mono text-3xs uppercase tracking-[0.06em] text-muted-foreground">
              W{week}
            </p>
            <ol className="mt-1.5 flex gap-1">
              {weekDays.map((day) => {
                const label = describeDay(day);
                return (
                  <li key={day.dayIndex}>
                    <div
                      title={label}
                      className={cn(
                        "relative size-9 rounded-md border",
                        day.awaitsContent
                          ? "border-dashed border-muted-foreground/50"
                          : "border-border",
                      )}
                      style={{
                        background: rampWash(
                          cohortMix(activityStep(day.cohort ?? 0)),
                        ),
                      }}
                    >
                      {/* The surface ring is what keeps the two layers from
                          adding together: the inner square reads against the
                          page, not against the cohort wash beneath it. */}
                      <span
                        aria-hidden
                        className="absolute inset-[5px] rounded-[3px]"
                        style={{
                          background: rampWash(youMix(activityStep(day.you))),
                          boxShadow: "0 0 0 2px var(--background)",
                        }}
                      />
                      <span className="sr-only">{label}</span>
                    </div>
                    <p className="mt-1 text-center font-mono text-3xs tabular-nums text-muted-foreground">
                      {day.dayIndex}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="size-3.5 rounded-[3px] border border-border"
            style={{ background: rampWash(youMix(4)) }}
          />
          You
        </span>
        {hasCohort && (
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="size-3.5 rounded-[3px] border border-border"
              style={{ background: rampWash(cohortMix(4)) }}
            />
            Everyone else
          </span>
        )}
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="size-3.5 rounded-[3px] border border-dashed border-muted-foreground/50"
          />
          Video still to come
        </span>
      </div>
    </section>
  );
}
