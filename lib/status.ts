/**
 * Single source for status vocabulary + colours.
 *
 * Every list/detail surface that renders a status should import from here
 * instead of re-declaring local Record maps. The rendering grammar is: the
 * semantic hue lives ONLY in a solid 6px dot (`dotClassName`); labels and
 * pill surfaces stay ink-on-card. Render inline as
 * `<span className={cn("size-1.5 rounded-full", dotClassName)} />` + label,
 * or as a pill via `<StatusPill status={...} />` from
 * `components/ui/status-pill.tsx`. Never reintroduce tinted-wash pills
 * (bg-x-50 text-x-800 border-x-200) - colour washes are reserved for the
 * brand aqua (`secondary`) on brand moments, not for status.
 */

export type StatusStyle = {
  label: string;
  /** For the 6px dot treatment: `<span className={cn("size-1.5 rounded-full", dotClassName)} />` */
  dotClassName: string;
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
  },
  paused: {
    label: "Paused",
    dotClassName: "bg-amber-500",
  },
  retired: {
    label: "Retired",
    dotClassName: "bg-muted-foreground/60",
  },
};

/* ------------------------------------------------------------------ */
/* Suggestions                                                         */
/* ------------------------------------------------------------------ */

export const SUGGESTION_STATUSES = [
  "open",
  "under_review",
  "accepted",
  "queued",
  "in_progress",
  "shipped",
  "declined",
] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

// Colour note: "accepted" and "in_progress" used to share the blue family -
// indistinguishable at the 6px dot size. "accepted" is violet (a decision
// has been made, work not yet started), "queued" sits between it as indigo
// (committed and prioritised), and "in_progress" is the brand cyan (actively
// being worked - the same hue the dashboard roadmap snapshot uses), so the
// pipeline stages read as clearly different hues at any size.
export const SUGGESTION_STATUS: Record<SuggestionStatus, StatusStyle> = {
  open: {
    label: "Open",
    dotClassName: "bg-muted-foreground",
  },
  under_review: {
    label: "Under review",
    dotClassName: "bg-amber-500",
  },
  accepted: {
    label: "Accepted",
    dotClassName: "bg-violet-500",
  },
  queued: {
    label: "Queued",
    dotClassName: "bg-indigo-500",
  },
  in_progress: {
    label: "In progress",
    dotClassName: "bg-cyan-500",
  },
  shipped: {
    label: "Shipped",
    dotClassName: "bg-emerald-500",
  },
  declined: {
    label: "Declined",
    dotClassName: "bg-rose-500",
  },
};
