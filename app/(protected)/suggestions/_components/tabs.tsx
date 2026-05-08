"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

// Shipped is intentionally not its own tab - it lives as the third lane on
// the roadmap board, so a separate Shipped tab would just duplicate that.
const TABS = [
  { value: "active", label: "Active" },
  { value: "roadmap", label: "Roadmap" },
  { value: "declined", label: "Declined" },
] as const;

export type Tab = (typeof TABS)[number]["value"];

/**
 * Tab strip for the Suggestions page. Counts were previously rendered as
 * pill badges next to each label, but the tab body shows the same numbers
 * once you click in - per-tab counts on inactive tabs were noise.
 */
export function SuggestionTabs({ active }: { active: Tab }) {
  const params = useSearchParams();
  function hrefFor(value: Tab) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", value);
    // Reset chip filters when switching tabs so each tab opens with its
    // canonical default selection.
    next.delete("statuses");
    return `/suggestions?${next.toString()}`;
  }
  return (
    <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 text-sm">
      {TABS.map((t) => (
        <Link
          key={t.value}
          href={hrefFor(t.value)}
          className={cn(
            "rounded-md px-3 py-1 transition-colors",
            active === t.value
              ? "bg-zinc-900 text-white"
              : "text-zinc-600 hover:bg-zinc-100",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
