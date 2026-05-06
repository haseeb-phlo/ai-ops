"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "tree", label: "Tree" },
  { value: "list", label: "List" },
] as const;

export type DirectoryMode = (typeof MODES)[number]["value"];

export const DEFAULT_MODE: DirectoryMode = "tree";

/**
 * Sub-switcher inside the Directory view: tree (org chart) vs list (table).
 * Shares the same outer toggle look as the parent ViewToggle but lives
 * inside the Directory page.
 */
export function DirectoryModeToggle({ active }: { active: DirectoryMode }) {
  const params = useSearchParams();

  function hrefFor(value: DirectoryMode): string {
    const next = new URLSearchParams(params.toString());
    next.set("view", "directory");
    next.set("mode", value);
    return `/map?${next.toString()}`;
  }

  return (
    <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 text-sm">
      {MODES.map((m) => (
        <Link
          key={m.value}
          href={hrefFor(m.value)}
          className={cn(
            "rounded-md px-3 py-1 transition-colors",
            active === m.value
              ? "bg-zinc-900 text-white"
              : "text-zinc-600 hover:bg-zinc-100",
          )}
        >
          {m.label}
        </Link>
      ))}
    </div>
  );
}
