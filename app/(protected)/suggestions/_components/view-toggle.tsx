"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "list" | "board";

/**
 * List vs Board switcher. Stored in the URL (`?view=list|board`) so the
 * choice persists per-tab and is shareable. Used on the Roadmap tab where
 * both presentations are useful; the other tabs default to list-only and
 * skip rendering the toggle.
 */
export function ViewToggle({ active }: { active: ViewMode }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setMode(mode: ViewMode) {
    const qs = new URLSearchParams(params.toString());
    qs.set("view", mode);
    startTransition(() => {
      router.push(`/suggestions?${qs.toString()}`);
    });
  }

  return (
    <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-xs">
      <button
        type="button"
        disabled={pending}
        onClick={() => setMode("list")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors",
          active === "list"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:bg-muted",
        )}
      >
        <List className="size-3" />
        List
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setMode("board")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors",
          active === "board"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:bg-muted",
        )}
      >
        <LayoutGrid className="size-3" />
        Board
      </button>
    </div>
  );
}
