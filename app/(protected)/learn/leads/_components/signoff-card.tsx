"use client";

import { useActionState, useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Textarea } from "@/components/ui/textarea";
import { signOffSubmission, type SignOffState } from "../actions";

export type PendingItem = {
  id: string;
  memberName: string;
  kind: string;
  title: string;
  promptText: string | null;
  taskSolved: string | null;
  timeSaved: string | null;
  artefactUrl: string | null;
  previousComment: string | null;
  /** The automated first pass, when there was one and it flagged this. */
  aiReview: {
    scores: Record<string, number>;
    feedback: string;
    why: string;
  } | null;
};

/** The four rubric dimensions, in the order the playbook lists them. */
const DIMENSIONS = [
  { key: "accuracy", label: "Accuracy", hint: "Does it actually do what it claims?" },
  { key: "completeness", label: "Completeness", hint: "Anything important missing?" },
  { key: "usefulness", label: "Usefulness", hint: "Clear enough for someone else to act on?" },
  { key: "reusability", label: "Reusability", hint: "Could a colleague run this as-is?" },
] as const;

const APPROVE_THRESHOLD = 3;

/**
 * One pending submission with its rubric, inline.
 *
 * Designed to be completable in under two minutes: everything needed to judge
 * it is on screen, the sliders default to a passing 3 so a straightforward
 * approval is two clicks, and the comment box only becomes required when it
 * actually matters - on a rejection.
 */
export function SignOffCard({ item }: { item: PendingItem }) {
  const [state, action, pending] = useActionState<SignOffState, FormData>(
    signOffSubmission,
    { kind: "idle" },
  );
  // Pre-filled from the automated pass where there is one, so the human job
  // is confirm-or-override rather than compose-from-scratch. Defaults to a
  // passing 3 otherwise, which is what makes a clean approval two clicks.
  const [scores, setScores] = useState<Record<string, number>>(
    item.aiReview?.scores ?? {
      accuracy: 3,
      completeness: 3,
      usefulness: 3,
      reusability: 3,
    },
  );
  const [comment, setComment] = useState(item.aiReview?.feedback ?? "");
  const [decision, setDecision] = useState<"approved" | "rejected">("approved");

  if (state.kind === "success") {
    return (
      <article className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        {item.memberName}&apos;s {item.title.toLowerCase()}{" "}
        {state.decision === "approved" ? "approved" : "sent back"}.
      </article>
    );
  }

  const belowThreshold = Object.values(scores).some((v) => v < APPROVE_THRESHOLD);
  const isCapstone = item.kind === "capstone";

  return (
    <article className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">
          {item.memberName} - {item.title}
        </h3>
        {item.timeSaved && (
          <span className="text-xs text-muted-foreground">
            saves {item.timeSaved}
          </span>
        )}
      </div>

      {item.taskSolved && (
        <p className="mt-1 text-sm text-muted-foreground">{item.taskSolved}</p>
      )}

      {item.aiReview && (
        <div className="mt-3 rounded-md border border-border border-l-2 border-l-primary bg-background p-3 text-xs">
          <p className="font-medium text-foreground">
            Reviewed first pass - flagged for you
          </p>
          <p className="mt-0.5 text-muted-foreground">{item.aiReview.why}</p>
          <p className="mt-1.5 text-muted-foreground">{item.aiReview.feedback}</p>
          <Eyebrow as="p" className="mt-1.5">
            Scores and comment below are its draft. Change anything.
          </Eyebrow>
        </div>
      )}

      {item.previousComment && (
        <div className="mt-3 rounded-md border border-border bg-muted/50 p-3 text-xs">
          <p className="font-medium text-foreground">
            You sent this back before
          </p>
          <p className="mt-0.5 text-muted-foreground">{item.previousComment}</p>
        </div>
      )}

      {item.promptText && (
        <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-muted/60 p-3 font-mono text-xs leading-relaxed text-foreground">
          {item.promptText}
        </pre>
      )}

      {item.artefactUrl && (
        <a
          href={item.artefactUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Open what they made
          <ExternalLinkIcon className="size-3" aria-hidden />
        </a>
      )}

      <form action={action} className="mt-4 space-y-4">
        <input type="hidden" name="submission_id" value={item.id} />
        <input type="hidden" name="decision" value={decision} />
        {isCapstone && (
          <input type="hidden" name="capstone_credits" value={2} />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {DIMENSIONS.map((d) => (
            <label key={d.key} className="space-y-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-foreground">
                  {d.label}
                </span>
                <span
                  className={cn(
                    "font-mono text-xs tabular-nums",
                    scores[d.key] < APPROVE_THRESHOLD
                      ? "text-warning"
                      : "text-muted-foreground",
                  )}
                >
                  {scores[d.key]}
                </span>
              </span>
              <input
                type="range"
                name={d.key}
                min={0}
                max={5}
                step={1}
                value={scores[d.key]}
                onChange={(e) =>
                  setScores((prev) => ({
                    ...prev,
                    [d.key]: Number(e.target.value),
                  }))
                }
                className="w-full accent-[var(--primary)]"
              />
              <span className="block text-3xs leading-tight text-muted-foreground">
                {d.hint}
              </span>
            </label>
          ))}
        </div>

        <div className="space-y-1">
          <Textarea
            name="comment"
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              decision === "rejected"
                ? "What should they change? (required)"
                : "Anything you'd add? (optional)"
            }
          />
          {belowThreshold && decision === "approved" && (
            <p className="text-xs leading-normal text-warning">
              Approval needs all four at {APPROVE_THRESHOLD} or above. Send it
              back with a comment instead.
            </p>
          )}
        </div>

        {state.kind === "error" && (
          <p className="text-sm text-destructive" role="alert">
            {state.message}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            disabled={pending || belowThreshold}
            onClick={() => setDecision("approved")}
          >
            {pending ? "Saving…" : "Approve"}
          </Button>
          <Button
            type="submit"
            variant="outline"
            disabled={pending || comment.trim() === ""}
            onClick={() => setDecision("rejected")}
          >
            Send back
          </Button>
          {comment.trim() === "" && (
            <span className="text-xs text-muted-foreground">
              Sending back needs a comment
            </span>
          )}
        </div>
      </form>
    </article>
  );
}
