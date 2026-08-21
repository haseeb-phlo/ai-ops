"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertTriangleIcon, DownloadIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CAPABILITY_AXIS_LABEL,
  QUESTION_BY_ID,
  type CapabilityQuestionId,
} from "@/lib/programme/questions";
import type {
  BandMigration,
  CapabilityMixRow,
  ConfidenceShiftRow,
  DriftComparison,
  FlowTelemetry,
} from "@/lib/programme/reporting";
import type { HoursSaved } from "@/lib/programme/reporting";
import { DriftChart } from "./drift-chart";
import { exportComparisonCsv } from "../_actions/reporting";

export type ReportingView = {
  drift: DriftComparison;
  capability: CapabilityMixRow[];
  confidence: ConfidenceShiftRow[];
  bands: BandMigration[];
  telemetry: FlowTelemetry[];
  hours: HoursSaved;
  tripwire: boolean;
  unmapped: string[];
  respondents: { before: number; after: number };
  beforeLabel: string;
  afterLabel: string;
};

export function ReportingPanel({
  view,
  filters,
  includingRehearsal,
}: {
  view: ReportingView;
  filters: { cohortId: string | null; functionName: string | null };
  includingRehearsal: boolean;
}) {
  return (
    <div className="space-y-6">
      <RehearsalToggle on={includingRehearsal} />
      {view.unmapped.length > 0 && (
        <p className="flex items-start gap-2 rounded-md border border-border border-l-2 border-l-warning bg-background px-3 py-2 text-xs text-foreground">
          <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
          <span>
            {view.unmapped.join(", ")}{" "}
            {view.unmapped.length === 1 ? "is" : "are"} not in any function
            group, so {view.unmapped.length === 1 ? "it is" : "they are"}{" "}
            reported as Unassigned. Add {view.unmapped.length === 1 ? "it" : "them"}{" "}
            to lib/programme/functions.ts.
          </span>
        </p>
      )}

      <DriftCard drift={view.drift} />
      <HoursCard hours={view.hours} />
      <CapabilityMixCard rows={view.capability} labels={view} />
      <ConfidenceCard rows={view.confidence} labels={view} />
      <BandCard rows={view.bands} labels={view} />
      <TelemetryCard telemetry={view.telemetry} tripped={view.tripwire} />
      <ExportCard filters={filters} />
    </div>
  );
}

/**
 * Rehearsal data is off by default and turning it on is a deliberate act, so
 * the state is in the URL and the banner is unmissable while it is on. A demo
 * that quietly leaves seeded numbers in a real report is worse than no demo.
 */
function RehearsalToggle({ on }: { on: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
      <p className="text-xs text-muted-foreground">
        {on ? (
          <span className="font-medium text-foreground">
            Showing rehearsal data. These are seeded figures, not real ones.
          </span>
        ) : (
          "Real cohorts only."
        )}
      </p>
      <Link
        href={on ? "?tab=reporting" : "?tab=reporting&rehearsal=1"}
        className="text-xs text-primary underline underline-offset-4"
      >
        {on ? "Hide rehearsal data" : "Include rehearsal data"}
      </Link>
    </div>
  );
}

/**
 * The organic-drift comparison, first because it is the argument.
 *
 * A before/after on the programme alone is weak: people were getting better at
 * AI anyway. Showing three months of untrained drift next to three weeks of
 * programme is what turns "people improved" into "the programme worked".
 */
function DriftCard({ drift }: { drift: DriftComparison }) {
  const leg = (
    label: string,
    sub: string,
    d: DriftComparison["organic"],
  ) => (
    <div className="rounded-md border border-border bg-background p-4">
      <p className="text-xs font-medium text-foreground">{label}</p>
      <p className="text-3xs text-muted-foreground">{sub}</p>
      <p className="mt-2 font-mono text-2xl tabular-nums text-foreground">
        {d.delta === null ? "-" : `${d.delta > 0 ? "+" : ""}${d.delta.toFixed(2)}`}
      </p>
      <p className="mt-1 text-3xs text-muted-foreground">
        {d.matched === 0
          ? "nobody answered both waves"
          : `${d.matched} people · ${d.beforeMean?.toFixed(2)} to ${d.afterMean?.toFixed(2)}`}
      </p>
      {d.matched > 0 && (
        <p className="mt-0.5 text-3xs text-muted-foreground">
          {d.improved} up · {d.unchanged} level · {d.declined} down
        </p>
      )}
    </div>
  );

  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">
        Did the programme do it, or would it have happened anyway?
      </h3>
      <p className="mt-1 max-w-prose text-xs text-muted-foreground">
        Both legs use only the people who answered both waves, so the figures
        are not confounded by who happened to respond.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {leg("Without training", "May to cohort start, three months", drift.organic)}
        {leg("With the programme", "Cohort start to day 15, three weeks", drift.programme)}
        <div className="rounded-md border border-primary/40 bg-secondary p-4">
          <p className="text-xs font-medium text-secondary-foreground">
            Difference
          </p>
          <p className="text-3xs text-secondary-foreground/80">
            Programme minus drift
          </p>
          <p className="mt-2 font-mono text-2xl tabular-nums text-secondary-foreground">
            {drift.difference === null
              ? "-"
              : `${drift.difference > 0 ? "+" : ""}${drift.difference.toFixed(2)}`}
          </p>
          <p className="mt-1 text-3xs text-secondary-foreground/80">
            {drift.difference === null
              ? "needs both waves to overlap"
              : "points of capability, out of 4"}
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <DriftChart
          organic={drift.organic.delta}
          programme={drift.programme.delta}
        />
      </div>
    </section>
  );
}

/**
 * Hours saved, stated plainly.
 *
 * A range rather than a number, because banded answers only support a range,
 * and no money: multiplying a self-reported estimate by a loaded cost produces
 * something that looks like finance and is not, and the first person to ask how
 * it was derived stops trusting everything next to it. The provenance is on the
 * card rather than in a footnote for the same reason.
 */
function HoursCard({ hours }: { hours: HoursSaved }) {
  if (hours.respondents === 0 && hours.cannotEstimate === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">
        Time saved
      </h3>
      {hours.respondents > 0 ? (
        <>
          <p className="mt-2 font-mono text-2xl tabular-nums text-foreground">
            {hours.lowTotal}
            {hours.lowTotal !== hours.highTotal && ` to ${hours.highTotal}`}
            {hours.topIsFloor && "+"}{" "}
            <span className="font-sans text-sm text-muted-foreground">
              hours a week
            </span>
          </p>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            Across {hours.respondents} {hours.respondents === 1 ? "person" : "people"},
            self-reported in banded answers, so it is a range rather than a
            figure.
            {hours.cannotEstimate > 0 &&
              ` ${hours.cannotEstimate} could not put a number on it.`}
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Nobody has given a usable estimate yet. {hours.cannotEstimate} said
          they could not put a number on it, which is worth watching: that count
          falling is one of the things the programme is for.
        </p>
      )}
    </section>
  );
}

function CapabilityMixCard({
  rows,
  labels,
}: {
  rows: CapabilityMixRow[];
  labels: { beforeLabel: string; afterLabel: string };
}) {
  const pct = (counts: number[], total: number) =>
    total === 0 ? 0 : Math.round((counts.slice(2).reduce((a, b) => a + b, 0) / total) * 100);

  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">
        Capability mix
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Share of people actually using each thing, meaning level 2 or above.
      </p>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="py-1 text-left font-medium">Area</th>
            <th className="py-1 text-right font-medium">{labels.beforeLabel}</th>
            <th className="py-1 text-right font-medium">{labels.afterLabel}</th>
            <th className="py-1 text-right font-medium">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const before = pct(r.before, r.beforeTotal);
            const after = pct(r.after, r.afterTotal);
            const change = after - before;
            return (
              <tr key={r.questionId} className="border-t border-border">
                <td className="py-1.5 text-foreground">
                  {CAPABILITY_AXIS_LABEL[r.questionId as CapabilityQuestionId]}
                </td>
                <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                  {r.beforeTotal === 0 ? "-" : `${before}%`}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {r.afterTotal === 0 ? "-" : `${after}%`}
                </td>
                <td
                  className={cn(
                    "py-1.5 text-right tabular-nums",
                    change > 0 ? "text-success" : "text-muted-foreground",
                  )}
                >
                  {r.beforeTotal === 0 || r.afterTotal === 0
                    ? "-"
                    : `${change > 0 ? "+" : ""}${change}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function ConfidenceCard({
  rows,
  labels,
}: {
  rows: ConfidenceShiftRow[];
  labels: { beforeLabel: string; afterLabel: string };
}) {
  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">
        Confidence
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Mean agreement, 0 to 4. Worth reading alongside capability: confidence
        moving faster than capability is the pattern to watch for.
      </p>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="py-1 text-left font-medium">Statement</th>
            <th className="py-1 text-right font-medium">{labels.beforeLabel}</th>
            <th className="py-1 text-right font-medium">{labels.afterLabel}</th>
            <th className="py-1 text-right font-medium">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.questionId} className="border-t border-border">
              <td className="py-1.5 pr-3 text-foreground">
                {QUESTION_BY_ID.get(r.questionId)?.text ?? r.questionId}
              </td>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                {r.beforeMean?.toFixed(2) ?? "-"}
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {r.afterMean?.toFixed(2) ?? "-"}
              </td>
              <td
                className={cn(
                  "py-1.5 text-right tabular-nums",
                  (r.delta ?? 0) > 0 ? "text-success" : "text-muted-foreground",
                )}
              >
                {r.delta === null
                  ? "-"
                  : `${r.delta > 0 ? "+" : ""}${r.delta.toFixed(2)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function BandCard({
  rows,
  labels,
}: {
  rows: BandMigration[];
  labels: { beforeLabel: string; afterLabel: string };
}) {
  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">
        Hours saved each week
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        The &quot;can&apos;t estimate&quot; row shrinking is itself a result:
        half the May respondents could not put a number on it.
      </p>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="py-1 text-left font-medium">Band</th>
            <th className="py-1 text-right font-medium">{labels.beforeLabel}</th>
            <th className="py-1 text-right font-medium">{labels.afterLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.band} className="border-t border-border">
              <td className="py-1.5 text-foreground">{r.band}</td>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                {r.before}
              </td>
              <td className="py-1.5 text-right tabular-nums">{r.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function TelemetryCard({
  telemetry,
  tripped,
}: {
  telemetry: FlowTelemetry[];
  tripped: boolean;
}) {
  const fmt = (s: number | null) =>
    s === null ? "-" : s < 90 ? `${s}s` : `${Math.round(s / 60)} min`;

  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">
        How long the check-in takes
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {telemetry.map((t) => (
          <div key={t.flow} className="rounded-md border border-border bg-background p-3">
            <p className="text-xs font-medium text-foreground">
              {t.flow === "returner" ? "Returners" : "First-timers"}
            </p>
            <p className="mt-1 font-mono text-lg tabular-nums text-foreground">
              {fmt(t.medianSeconds)}
            </p>
            <p className="text-3xs text-muted-foreground">
              median, {t.responses} response{t.responses === 1 ? "" : "s"}
            </p>
          </div>
        ))}
      </div>
      {tripped && (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-border border-l-2 border-l-warning bg-background px-3 py-2 text-xs text-foreground">
          <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
          <span>
            Returners are taking over six minutes. The pre-fill is meant to make
            an unchanged submission take under one, so something has stopped
            working. Left alone, the next wave&apos;s response rate falls before
            anyone works out why.
          </span>
        </p>
      )}
    </section>
  );
}

function ExportCard({
  filters,
}: {
  filters: { cohortId: string | null; functionName: string | null };
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const download = () => {
    setError(null);
    startTransition(async () => {
      const result = await exportComparisonCsv(filters);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">
        Export
      </h3>
      <p className="mt-1 max-w-prose text-xs text-muted-foreground">
        Per-question figures for whatever is currently filtered, one row per
        question per wave. Aggregates only, no individual answers.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={download}
        disabled={pending}
      >
        <DownloadIcon aria-hidden />
        {pending ? "Preparing..." : "Download CSV"}
      </Button>
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
