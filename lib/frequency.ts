// Categorical run cadence shared by workflows and AI initiatives.
//
// Storage shape: the DB keeps the numeric `frequency_per_week` /
// `uses_per_week` columns (dashboard math reads them directly) AND a
// `frequency_cadence` text column with the user's choice. On every
// write the numeric column is set from the cadence via CADENCE_PER_WEEK
// so the two stay consistent and dashboards reflect what the user picked.

export const CADENCES = ["daily", "weekly", "fortnightly", "monthly"] as const;

export type Cadence = (typeof CADENCES)[number];

export const CADENCE_LABEL: Record<Cadence, string> = {
  daily: "Daily",
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
};

// Per-week multiplier each cadence resolves to. Monthly uses 12/52 so a
// "monthly" run averages out to ~0.231 per week — matters because all
// dashboard impact aggregates (minutes saved/wk, cost saved/wk) multiply
// per-use values by this number.
export const CADENCE_PER_WEEK: Record<Cadence, number> = {
  daily: 7,
  weekly: 1,
  fortnightly: 0.5,
  monthly: 12 / 52,
};

export function isCadence(value: unknown): value is Cadence {
  return typeof value === "string" && (CADENCES as readonly string[]).includes(value);
}

export function cadenceToPerWeek(cadence: Cadence): number {
  return CADENCE_PER_WEEK[cadence];
}

// Map a legacy numeric value to the closest cadence bucket. Used only
// for display when a row predates the cadence column. The buckets are
// asymmetric on purpose: anything 4+ a week is effectively daily, the
// 0.4–0.75 band is fortnightly territory, and anything below ~0.35 is
// monthly. Returns null for 0 / null so callers can show a dash.
export function perWeekToCadence(value: number | null | undefined): Cadence | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  if (value >= 4) return "daily";
  if (value > 0.75) return "weekly";
  if (value > 0.35) return "fortnightly";
  return "monthly";
}

// Display helper: prefer the explicit cadence; fall back to bucketing the
// numeric value; return null when there's nothing to show. Accepts the
// raw `string | null` shape Supabase rows hand us so callers don't have
// to narrow at every read site.
export function formatCadence(
  cadence: string | null | undefined,
  perWeek: number | null | undefined,
): string | null {
  if (isCadence(cadence)) return CADENCE_LABEL[cadence];
  const inferred = perWeekToCadence(perWeek);
  return inferred ? CADENCE_LABEL[inferred] : null;
}
