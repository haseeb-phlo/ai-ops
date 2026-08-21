import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  ACHIEVEMENT_PHRASE,
  deltaChipState,
  hoursBandShift,
  insightSentence,
  newlyAcquiredAxes,
  type AxisScores,
} from "@/lib/programme/score";
import type { WaveScore } from "@/lib/programme/ai-score";
import { ScoreRadar } from "./score-radar";

/**
 * Screen 1 - "Your AI Score". Renders immediately on submit, every wave.
 *
 * Screen 2 (the day-15 graduation view) is the same component with
 * `graduation` set: it adds the three stat rows and the certificate footer.
 */
export function ResultScreen({
  current,
  previous,
  companyAvg,
  graduation = false,
}: {
  current: WaveScore;
  previous: WaveScore | null;
  companyAvg: number | null;
  graduation?: boolean;
}) {
  const chip = deltaChipState(
    current.cap_avg,
    previous?.cap_avg ?? null,
    previous?.waveLabel ?? "",
  );
  const insight = insightSentence(current.scores);
  const gained = previous
    ? newlyAcquiredAxes(previous.scores, current.scores)
    : [];
  const bandShift = previous
    ? hoursBandShift(previous.hours_band, current.hours_band)
    : null;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-background p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Your AI Score:{" "}
            <span className="tabular-nums">
              {current.cap_avg?.toFixed(1) ?? "-"}
            </span>
            <span className="text-muted-foreground"> / 4</span>
          </h2>
          <DeltaChip chip={chip} />
        </div>

        {insight && (
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            {insight}
          </p>
        )}

        <div className="mt-4">
          <ScoreRadar
            current={current.scores}
            previous={previous?.scores ?? null}
            currentLabel={current.waveLabel}
            previousLabel={previous?.waveLabel ?? null}
          />
        </div>

        {companyAvg !== null && (
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            Phlo average today:{" "}
            <span className="tabular-nums">{companyAvg.toFixed(1)}</span>
          </p>
        )}
      </div>

      {graduation && previous && (
        <div className="rounded-lg border border-border bg-background p-5 sm:p-6">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            Three weeks on
          </h3>
          <dl className="mt-3 divide-y divide-border">
            <StatRow
              label="Overall score"
              value={
                current.cap_avg !== null && previous.cap_avg !== null
                  ? `${previous.cap_avg.toFixed(1)} → ${current.cap_avg.toFixed(1)}`
                  : "-"
              }
            />
            <StatRow
              label="Hours saved each week"
              value={
                bandShift
                  ? `${bandShift.from} → ${bandShift.to}`
                  : (current.hours_band ?? "-")
              }
            />
            <StatRow
              label="New this cohort"
              value={
                gained.length > 0
                  ? gained.map((q) => ACHIEVEMENT_PHRASE[q]).join(" · ")
                  : "Steady across the board"
              }
            />
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            We&apos;ll check in once more in three months - 60 seconds,
            pre-filled.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/learn/track" className={cn(buttonVariants())}>
          Back to the programme
        </Link>
      </div>
    </div>
  );
}

/**
 * The delta chip.
 *
 * A DROP renders neutral grey and says "recalibrated" - never red, never a
 * minus sign. Someone who now understands what "using Skills well" means and
 * marks themselves lower has learned something; punishing that visually
 * teaches people to inflate the next wave, which destroys the instrument.
 */
function DeltaChip({
  chip,
}: {
  chip: ReturnType<typeof deltaChipState>;
}) {
  if (chip.kind === "none") return null;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        chip.kind === "up"
          ? "bg-background"
          : "bg-muted text-muted-foreground",
      )}
    >
      {chip.label}
    </span>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export type { AxisScores };
