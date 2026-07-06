/**
 * Single source for status vocabulary + colours.
 *
 * Every list/detail surface that renders a status dot or pill should import
 * from here instead of re-declaring local Record maps. Palette classes are
 * deliberate (the app is light-mode only); the point of this module is one
 * definition site, not token purity.
 */

export type StatusStyle = {
  label: string;
  /** For the 6px dot treatment: `<span className={cn("size-1.5 rounded-full", dotClassName)} />` */
  dotClassName: string;
  /** For badge/pill treatments: border + bg + text classes. */
  badgeClassName: string;
};

/* ------------------------------------------------------------------ */
/* Interventions / AI initiatives                                      */
/* ------------------------------------------------------------------ */

export const INTERVENTION_STATUSES = ["active", "paused", "retired"] as const;
export type InterventionStatus = (typeof INTERVENTION_STATUSES)[number];

export const INTERVENTION_STATUS: Record<InterventionStatus, StatusStyle> = {
  active: {
    label: "Active",
    dotClassName: "bg-emerald-500",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  paused: {
    label: "Paused",
    dotClassName: "bg-amber-500",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
  },
  retired: {
    label: "Retired",
    dotClassName: "bg-muted-foreground/60",
    badgeClassName: "border-border bg-muted text-muted-foreground",
  },
};

/* ------------------------------------------------------------------ */
/* Suggestions                                                         */
/* ------------------------------------------------------------------ */

export const SUGGESTION_STATUSES = [
  "open",
  "under_review",
  "accepted",
  "in_progress",
  "shipped",
  "declined",
] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

// Colour note: "accepted" used to be bg-blue-500 and "in_progress"
// bg-blue-600 - indistinguishable at the 6px dot size. "accepted" is now
// violet (a decision has been made, work not yet started) while
// "in_progress" keeps the blue family (actively being worked), so the two
// read as clearly different hues at any size.
export const SUGGESTION_STATUS: Record<SuggestionStatus, StatusStyle> = {
  open: {
    label: "Open",
    dotClassName: "bg-muted-foreground",
    badgeClassName: "border-border bg-muted text-foreground",
  },
  under_review: {
    label: "Under review",
    dotClassName: "bg-amber-500",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
  },
  accepted: {
    label: "Accepted",
    dotClassName: "bg-violet-500",
    badgeClassName: "border-violet-200 bg-violet-50 text-violet-700",
  },
  in_progress: {
    label: "In progress",
    dotClassName: "bg-blue-500",
    badgeClassName: "border-blue-200 bg-blue-50 text-blue-700",
  },
  shipped: {
    label: "Shipped",
    dotClassName: "bg-emerald-500",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  declined: {
    label: "Declined",
    dotClassName: "bg-red-500",
    badgeClassName: "border-red-200 bg-red-50 text-red-700",
  },
};
