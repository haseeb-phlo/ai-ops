"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleSuggestionVote } from "../actions";

/**
 * Optimistic upvote toggle: count and pressed state flip immediately; if the
 * server rejects, useOptimistic reverts to the (unchanged) server state when
 * the transition settles and we surface a small inline error.
 */
export function VoteButton({
  suggestionId,
  count,
  voted,
}: {
  suggestionId: string;
  count: number;
  voted: boolean;
}) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimistic, applyOptimistic] = useOptimistic(
    { count, voted },
    (state) => ({
      count: state.count + (state.voted ? -1 : 1),
      voted: !state.voted,
    }),
  );

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      applyOptimistic(undefined);
      const fd = new FormData();
      fd.set("suggestion_id", suggestionId);
      const result = await toggleSuggestionVote(fd);
      if (!result.ok) setError(result.message);
    });
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={optimistic.voted}
        title={optimistic.voted ? "Withdraw vote" : "Upvote"}
        className={cn(
          "inline-flex flex-col items-center justify-center rounded-md border px-2 py-1 text-xs transition-colors",
          optimistic.voted
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-background text-foreground hover:border-input hover:bg-muted/40",
        )}
      >
        <ChevronUp className="size-3.5" />
        <span className="mt-0.5 font-mono text-[10px] tabular-nums">
          {optimistic.count}
        </span>
      </button>
      {error && (
        <span
          role="alert"
          title={error}
          className="max-w-24 text-center text-[10px] leading-tight text-destructive"
        >
          Vote failed
        </span>
      )}
    </div>
  );
}
