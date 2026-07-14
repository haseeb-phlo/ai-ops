"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SuggestionStatus as Status } from "@/lib/status";
import { setSuggestionStatus } from "../actions";

/**
 * Inline status-change controls for a suggestion. Action set is gated on
 * permission - the parent decides what to render.
 *
 *   - Champion of submitter's team: under_review / declined
 *   - Super admin: any of the above PLUS accepted (commits to building),
 *     queued ("Add to queue" - joins the roadmap's prioritised queue),
 *     in_progress ("Start progress"), and back-to-open (reopen a declined
 *     suggestion)
 */
export function StatusActions({
  suggestionId,
  status,
  canTriage,
  canCommit,
}: {
  suggestionId: string;
  status: Status;
  canTriage: boolean;
  canCommit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [showDecline, setShowDecline] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function setStatus(target: Status, declineReason?: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("suggestion_id", suggestionId);
      fd.set("status", target);
      if (declineReason) fd.set("decline_reason", declineReason);
      const result = await setSuggestionStatus({ kind: "idle" }, fd);
      if (result.kind === "error") {
        setError(result.message);
      } else {
        setError(null);
        setShowDecline(false);
        setReason("");
      }
    });
  }

  if (showDecline) {
    return (
      <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
        <p className="text-xs font-medium text-foreground">
          Reason for declining (visible to everyone)
        </p>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="e.g. owned by the Clinical platform, out of scope for AI Ops."
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setShowDecline(false);
              setReason("");
              setError(null);
            }}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending || reason.trim().length < 3}
            onClick={() => setStatus("declined", reason.trim())}
          >
            {pending ? "Saving" : "Decline with reason"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canTriage && status === "open" && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setStatus("under_review")}
        >
          Under review
        </Button>
      )}
      {canCommit && (status === "open" || status === "under_review") && (
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => setStatus("accepted")}
        >
          Accept
        </Button>
      )}
      {canCommit && status === "accepted" && (
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => setStatus("queued")}
        >
          Add to queue
        </Button>
      )}
      {canCommit && (status === "accepted" || status === "queued") && (
        <Button
          type="button"
          size="sm"
          variant={status === "queued" ? "default" : "outline"}
          disabled={pending}
          onClick={() => setStatus("in_progress")}
        >
          Start progress
        </Button>
      )}
      {canTriage && status !== "declined" && status !== "shipped" && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-destructive"
          disabled={pending}
          onClick={() => setShowDecline(true)}
        >
          Decline
        </Button>
      )}
      {canCommit && status === "declined" && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setStatus("open")}
        >
          Reopen
        </Button>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
