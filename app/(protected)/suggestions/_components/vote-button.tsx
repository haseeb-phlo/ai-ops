"use client";

import { useTransition } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleSuggestionVote } from "../actions";

export function VoteButton({
  suggestionId,
  count,
  voted,
}: {
  suggestionId: string;
  count: number;
  voted: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          const fd = new FormData();
          fd.set("suggestion_id", suggestionId);
          await toggleSuggestionVote(fd);
        })
      }
      aria-pressed={voted}
      disabled={pending}
      title={voted ? "Withdraw vote" : "Upvote"}
      className={cn(
        "inline-flex flex-col items-center justify-center rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-50",
        voted
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-foreground hover:border-input hover:bg-muted/40",
      )}
    >
      <ChevronUp className="size-3.5" />
      <span className="mt-0.5 font-mono text-[10px] tabular-nums">
        {count}
      </span>
    </button>
  );
}
