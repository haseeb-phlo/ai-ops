"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const VIEWS = [
  { value: "champions", label: "AI Champions" },
  { value: "map", label: "Map" },
  { value: "directory", label: "Directory" },
] as const;

export type ViewKey = (typeof VIEWS)[number]["value"];

export const DEFAULT_VIEW: ViewKey = "champions";

export function ViewToggle({ active }: { active: ViewKey }) {
  // View-scoped params (team, q) are filter state, not view identity, so
  // switching the top-level view drops them. Each tab opens in its
  // canonical default state instead of inheriting stale filters.
  function hrefFor(value: ViewKey): string {
    return `/map?view=${value}`;
  }

  return (
    <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-sm">
      {VIEWS.map((v) => (
        <Link
          key={v.value}
          href={hrefFor(v.value)}
          className={cn(
            "rounded-md px-3 py-1 transition-colors",
            active === v.value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );
}
