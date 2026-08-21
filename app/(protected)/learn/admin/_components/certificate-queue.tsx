"use client";

import { useActionState, useState } from "react";
import { AwardIcon, CheckIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  decideCertificates,
  type CertificateActionState,
} from "../_actions/certificates";

export type CertificateCandidate = {
  cohortMemberId: string;
  displayName: string;
  cohortName: string;
  completedAt: string;
  declined: boolean;
};

/**
 * Certificates awaiting approval.
 *
 * Batched on purpose: a cohort finishes in a cluster, and approving fifteen
 * people one at a time is the sort of admin task that quietly does not get
 * done. Approving together also produces one channel announcement rather than
 * fifteen.
 */
export function CertificateQueue({
  candidates,
  slackConfigured,
}: {
  candidates: CertificateCandidate[];
  slackConfigured: boolean;
}) {
  const [state, action, pending] = useActionState<
    CertificateActionState,
    FormData
  >(decideCertificates, { kind: "idle" });
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(candidates.filter((c) => !c.declined).map((c) => c.cohortMemberId)),
  );
  const [decision, setDecision] = useState<"issue" | "decline">("issue");

  if (candidates.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        No certificates waiting. They appear here once someone passes all four
        gates.
      </p>
    );
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="decision" value={decision} />

      <div className="flex items-start gap-2 rounded-lg border border-border bg-background p-3 text-sm">
        <AwardIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-muted-foreground">
          These people have passed all four gates. Issuing reveals their
          certificate and{" "}
          {slackConfigured
            ? "posts one message to their cohort channel."
            : "would post to their cohort channel, once Slack is connected."}
        </p>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border bg-background">
        {candidates.map((c) => (
          <li key={c.cohortMemberId} className="flex items-center gap-3 px-4 py-3">
            <input
              type="checkbox"
              name="cohort_member_id"
              value={c.cohortMemberId}
              checked={selected.has(c.cohortMemberId)}
              onChange={() => toggle(c.cohortMemberId)}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-foreground">
                {c.displayName}
                {c.declined && (
                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-3xs uppercase tracking-wide text-muted-foreground">
                    previously held back
                  </span>
                )}
              </span>
              <span className="block text-xs text-muted-foreground">
                {c.cohortName} · finished{" "}
                {format(new Date(c.completedAt), "d MMM yyyy")}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <Textarea
        name="note"
        rows={2}
        placeholder="Optional note (only you see this)"
      />

      {state.kind === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
      {state.kind === "success" && (
        <p className="flex items-center gap-2 text-sm text-foreground">
          <CheckIcon className="size-4 text-success" aria-hidden />
          {state.issued > 0
            ? `Issued ${state.issued} certificate${state.issued === 1 ? "" : "s"}.${state.announced ? " Announced in the cohort channel." : ""}`
            : "Held back."}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={pending || selected.size === 0}
          onClick={() => setDecision("issue")}
        >
          {pending
            ? "Saving…"
            : `Issue ${selected.size} certificate${selected.size === 1 ? "" : "s"}`}
        </Button>
        <Button
          type="submit"
          variant="outline"
          disabled={pending || selected.size === 0}
          onClick={() => setDecision("decline")}
        >
          Hold back
        </Button>
      </div>
    </form>
  );
}
