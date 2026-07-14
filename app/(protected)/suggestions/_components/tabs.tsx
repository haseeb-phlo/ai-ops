"use client";

import { useSearchParams } from "next/navigation";
import { SegmentedControl } from "@/components/ui/segmented-control";

// Accepted/queued/in-progress/shipped suggestions aren't tabs here - they
// live on the /roadmap board (its own nav section), so tabs here only cover
// the intake funnel: ideas being voted on and triaged, plus the declined
// record.
const TABS = [
  { value: "active", label: "Active" },
  { value: "declined", label: "Declined" },
] as const;

export type Tab = (typeof TABS)[number]["value"];

/**
 * Tab strip for the Suggestions page, rendered with the shared
 * SegmentedControl in link mode (Next Links with aria-current on the active
 * tab). Counts were previously rendered as pill badges next to each label,
 * but the tab body shows the same numbers once you click in - per-tab
 * counts on inactive tabs were noise.
 */
export function SuggestionTabs({ active }: { active: Tab }) {
  const params = useSearchParams();
  function hrefFor(value: Tab) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", value);
    return `/suggestions?${next.toString()}`;
  }
  return (
    <SegmentedControl
      aria-label="Suggestion tabs"
      value={active}
      className="w-fit"
      options={TABS.map((t) => ({
        value: t.value,
        label: t.label,
        href: hrefFor(t.value),
      }))}
    />
  );
}
