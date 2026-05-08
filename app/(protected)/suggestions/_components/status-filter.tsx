"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

type Status =
  | "open"
  | "under_review"
  | "accepted"
  | "in_progress"
  | "shipped"
  | "declined";

const STATUS_DOT: Record<Status, string> = {
  open: "bg-zinc-400",
  under_review: "bg-amber-500",
  accepted: "bg-blue-500",
  in_progress: "bg-blue-600",
  shipped: "bg-emerald-500",
  declined: "bg-red-500",
};

const STATUS_LABEL: Record<Status, string> = {
  open: "Open",
  under_review: "Under review",
  accepted: "Accepted",
  in_progress: "In progress",
  shipped: "Shipped",
  declined: "Declined",
};

/**
 * Toggleable status chips that refine the rows shown within the active
 * Suggestions tab. State lives in the URL (`?statuses=open,accepted`) so
 * filter selections are shareable + survive refresh, and so server-side
 * filtering can be added later if/when the row count justifies it.
 *
 * Each chip flips inclusion, never exclusion - the chips union into the
 * visible set. With every chip off the user sees nothing, which is honest:
 * "you've hidden everything." Default state is set by the page's own
 * lookup of `statuses` URL param and falls back to "all in this tab".
 */
export function StatusFilter({
  available,
  active,
  counts,
}: {
  available: Status[];
  active: Set<Status>;
  counts: Partial<Record<Status, number>>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function toggle(status: Status) {
    const next = new Set(active);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    const qs = new URLSearchParams(params.toString());
    if (next.size === 0 || next.size === available.length) {
      qs.delete("statuses");
    } else {
      qs.set("statuses", [...next].join(","));
    }
    startTransition(() => {
      router.push(`/suggestions?${qs.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {available.map((s) => {
        const isActive = active.has(s);
        return (
          <button
            key={s}
            type="button"
            disabled={pending}
            onClick={() => toggle(s)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50",
              isActive
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                isActive ? "bg-white/80" : STATUS_DOT[s],
              )}
            />
            {STATUS_LABEL[s]}
            {counts[s] !== undefined && (
              <span
                className={cn(
                  "ml-0.5 font-mono text-[10px] tabular-nums",
                  isActive ? "text-white/70" : "text-zinc-400",
                )}
              >
                {counts[s]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
