"use server";

import { requireWriter } from "@/lib/auth";
import { toCsv } from "@/lib/programme/anonymise";
import { CAPABILITY_AXIS_LABEL, QUESTION_BY_ID } from "@/lib/programme/questions";
import {
  capabilityMix,
  confidenceShift,
  bandMigration,
  driftComparison,
  proportionAtOrAbove,
} from "@/lib/programme/reporting";
import { filterRows, loadReportingData } from "@/lib/programme/reporting-data";

/**
 * CSV of the current comparison.
 *
 * AGGREGATES ONLY: counts and means per question, never a row per person. The
 * export exists so numbers can be pasted into a board pack, and a spreadsheet
 * of individual colleagues' self-assessments is not something that should be
 * one click away from leaving the building.
 */

export type ExportResult =
  | { ok: true; csv: string; filename: string }
  | { ok: false; message: string };

export async function exportComparisonCsv(filters: {
  cohortId: string | null;
  functionName: string | null;
}): Promise<ExportResult> {
  const gate = await requireWriter();
  if (!gate.ok) return { ok: false, message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { ok: false, message: "Only super admins can export." };
  }

  const data = await loadReportingData();
  const rows = filterRows(data.rows, filters);

  const baseline = rows.filter((r) => r.wave === "cohort_baseline");
  const post = rows.filter((r) => r.wave === "post");

  const out: (string | null)[][] = [
    ["section", "question", "metric", "cohort_baseline", "post", "change"],
  ];

  for (const row of capabilityMix(baseline, post)) {
    const before = proportionAtOrAbove(row.before, 2);
    const after = proportionAtOrAbove(row.after, 2);
    out.push([
      "capability",
      CAPABILITY_AXIS_LABEL[row.questionId],
      "% at level 2+",
      String(before),
      String(after),
      String(Math.round((after - before) * 10) / 10),
    ]);
  }

  for (const row of confidenceShift(baseline, post)) {
    out.push([
      "confidence",
      QUESTION_BY_ID.get(row.questionId)?.text ?? row.questionId,
      "mean 0-4",
      row.beforeMean?.toFixed(2) ?? "",
      row.afterMean?.toFixed(2) ?? "",
      row.delta?.toFixed(2) ?? "",
    ]);
  }

  for (const row of bandMigration(baseline, post)) {
    out.push([
      "hours saved",
      row.band,
      "respondents",
      String(row.before),
      String(row.after),
      String(row.after - row.before),
    ]);
  }

  // The drift comparison, so the export carries the argument and not just the
  // raw figures.
  const drift = driftComparison(rows);
  out.push([
    "drift",
    "May to cohort start (no training)",
    "mean capability change",
    drift.organic.beforeMean?.toFixed(2) ?? "",
    drift.organic.afterMean?.toFixed(2) ?? "",
    drift.organic.delta?.toFixed(2) ?? "",
  ]);
  out.push([
    "drift",
    "Cohort start to day 15 (programme)",
    "mean capability change",
    drift.programme.beforeMean?.toFixed(2) ?? "",
    drift.programme.afterMean?.toFixed(2) ?? "",
    drift.programme.delta?.toFixed(2) ?? "",
  ]);

  const scope = [
    filters.cohortId
      ? (data.cohorts.find((c) => c.id === filters.cohortId)?.name ?? "cohort")
      : "all-cohorts",
    filters.functionName ?? "all-functions",
  ]
    .join("-")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase();

  return {
    ok: true,
    csv: toCsv(out),
    filename: `ai-score-${scope}.csv`,
  };
}
