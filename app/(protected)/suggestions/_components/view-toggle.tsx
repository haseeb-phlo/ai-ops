"use client";

import { useSearchParams } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";

export type ViewMode = "list" | "board";

/**
 * List vs Board switcher. Stored in the URL (`?view=list|board`) so the
 * choice persists per-tab and is shareable. Used on the Roadmap tab where
 * both presentations are useful; the other tabs default to list-only and
 * skip rendering the toggle. Rendered with the shared SegmentedControl in
 * link mode (aria-current on the active view).
 */
export function ViewToggle({ active }: { active: ViewMode }) {
  const params = useSearchParams();
  function hrefFor(mode: ViewMode) {
    const qs = new URLSearchParams(params.toString());
    qs.set("view", mode);
    return `/suggestions?${qs.toString()}`;
  }
  return (
    <SegmentedControl
      aria-label="Roadmap view"
      value={active}
      className="w-fit"
      options={[
        { value: "list", label: "List", icon: List, href: hrefFor("list") },
        {
          value: "board",
          label: "Board",
          icon: LayoutGrid,
          href: hrefFor("board"),
        },
      ]}
    />
  );
}
