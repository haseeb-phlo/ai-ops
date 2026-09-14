import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/ui/eyebrow";
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
 *
 * Two things the heading and the legend are careful not to repeat.
 *
 * The heading is "Day by day" and not "Your fifteen days", because the
 * timeline further down the page is already titled "All 15 days" and the two
 * headings side by side read as the same section twice. What this strip
 * uniquely holds is the comparison, so the legend names it and the heading
 * stays out of the way.
 *
 * And the legend no longer carries a "video still to come" key for the dashed
 * cells. `describeDay` already ends such a day with "video still to come", so
 * the fact is in the tooltip and in the screen-reader sentence for the exact
 * cells it applies to - a third copy in a key, spelling out a border style
 * nobody asked about, was the one line in the legend that earned nothing. The
 * whole row goes when there is no cohort data to compare against, since a key
 * explaining "You" against no alternative explains nothing.
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
        Day by day
      </h2>

      <div className="mt-4 flex flex-wrap items-start gap-x-6 gap-y-4">
        {weeks.map(({ week, days: weekDays }) => (
          <div key={week}>
            <Eyebrow as="p" mono>
              W{week}
            </Eyebrow>
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

      {hasCohort && (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="size-3.5 rounded-[3px] border border-border"
              style={{ background: rampWash(youMix(4)) }}
            />
            You
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="size-3.5 rounded-[3px] border border-border"
              style={{ background: rampWash(cohortMix(4)) }}
            />
            Everyone else
          </span>
        </div>
      )}
    </section>
  );
}
