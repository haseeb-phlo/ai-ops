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

/* ------------------------------------------------------------------ */
/* Core Programme                                                      */
/* ------------------------------------------------------------------ */

// RAG is a health signal, so it uses the same three hues the rest of the app
// reserves for good/warning/bad - emerald, amber, rose. Rendered as a dot like
// everything else: a members-x-days heatmap of colour washes would be a wall
// of confetti and would break the grammar the whole app follows.

export const PROGRAMME_RAG_STATUSES = ["green", "amber", "red"] as const;
export type ProgrammeRagStatus = (typeof PROGRAMME_RAG_STATUSES)[number];

export const PROGRAMME_RAG: Record<ProgrammeRagStatus, StatusStyle> = {
  green: { label: "On track", dotClassName: "bg-emerald-500" },
  amber: { label: "Slipping", dotClassName: "bg-amber-500" },
  red: { label: "Behind", dotClassName: "bg-rose-500" },
};

// Item state on the member's timeline. "Locked" and "available" are states of
// the programme rather than of the member, so they stay neutral ink; only
// finished work earns a colour.
export const PROGRAMME_ITEM_STATES = [
  "locked",
  "available",
  "started",
  "complete",
] as const;
export type ProgrammeItemState = (typeof PROGRAMME_ITEM_STATES)[number];

export const PROGRAMME_ITEM_STATE: Record<ProgrammeItemState, StatusStyle> = {
  locked: { label: "Locked", dotClassName: "bg-muted-foreground/40" },
  available: { label: "To do", dotClassName: "bg-muted-foreground" },
  started: { label: "In progress", dotClassName: "bg-cyan-500" },
  complete: { label: "Complete", dotClassName: "bg-emerald-500" },
};

// Gate chips. A gate is binary, so there are only two styles - passed, or not
// yet. "Not yet" is deliberately neutral rather than red: a member on day 3
// has failed nothing.
export const PROGRAMME_GATE_PASSED: StatusStyle = {
  label: "Passed",
  dotClassName: "bg-emerald-500",
};
export const PROGRAMME_GATE_PENDING: StatusStyle = {
  label: "Not yet",
  dotClassName: "bg-muted-foreground/40",
};

// Sign-off state on a submission (rendered from Part 3 onward).
export const PROGRAMME_SIGNOFF_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;
export type ProgrammeSignoffStatus =
  (typeof PROGRAMME_SIGNOFF_STATUSES)[number];

export const PROGRAMME_SIGNOFF: Record<ProgrammeSignoffStatus, StatusStyle> = {
  pending: { label: "Awaiting sign-off", dotClassName: "bg-amber-500" },
  approved: { label: "Approved", dotClassName: "bg-emerald-500" },
  rejected: { label: "Needs another go", dotClassName: "bg-rose-500" },
};
