"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const VIEWS = [
  { value: "champions", label: "AI Champions" },
  { value: "map", label: "Map" },
  { value: "directory", label: "Directory" },
] as const;

export type ViewKey = (typeof VIEWS)[number]["value"];

export const DEFAULT_VIEW: ViewKey = "champions";

export function ViewToggle({ active }: { active: ViewKey }) {
  const params = useSearchParams();

  function hrefFor(value: ViewKey): string {
    // Always include ?view= so each toggle target is a distinct URL. Without
    // this, clicking AI Champions while the URL is bare /map would resolve
    // to the same href and the router cache treats it as a no-op.
    const next = new URLSearchParams(params.toString());
    next.set("view", value);
    return `/map?${next.toString()}`;
  }

  return (
    <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 text-sm">
      {VIEWS.map((v) => (
        <Link
          key={v.value}
          href={hrefFor(v.value)}
          className={cn(
            "rounded-md px-3 py-1 transition-colors",
            active === v.value
              ? "bg-zinc-900 text-white"
              : "text-zinc-600 hover:bg-zinc-100",
          )}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );
}
