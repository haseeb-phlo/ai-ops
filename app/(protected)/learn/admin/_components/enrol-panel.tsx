"use client";

import { useActionState, useState } from "react";
import { UserPlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enrolRoster, cancelPendingEnrolment, type EnrolState } from "../_actions/enrolment";

export type PendingRow = {
  id: string;
  email: string;
  addedAt: string;
};

/**
 * Put a roster into a cohort.
 *
 * Paste the list. Anyone with an account is enrolled now; anyone who has never
 * signed in is held as pending and enrolled automatically the first time they
 * do, which matters because most of the company is in the second group.
 */
export function EnrolPanel({
  cohortId,
  cohortName,
  cohortStatus,
  notEnrolledEmails,
  pending,
}: {
  cohortId: string;
  cohortName: string;
  cohortStatus: string;
  /** Everyone in `people` who isn't in any planned or live cohort. */
  notEnrolledEmails: string[];
  pending: PendingRow[];
}) {
  const [text, setText] = useState("");
  const [state, submit, submitting] = useActionState<EnrolState, FormData>(
    enrolRoster,
    { kind: "idle" },
  );
  const [cancelState, cancel] = useActionState<EnrolState, FormData>(
    cancelPendingEnrolment,
    { kind: "idle" },
  );

  const closed = cohortStatus !== "planned" && cohortStatus !== "live";

  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">
        Enrol people
      </h3>
      <p className="mt-1 max-w-prose text-xs text-muted-foreground">
        Adds people to <span className="font-medium text-foreground">{cohortName}</span>.
        Paste addresses in any shape - one per line, comma separated, or
        straight out of a To: field. Anyone who has never signed in is held
        until their first visit and enrolled then, so you do not have to chase
        them first.
      </p>

      {closed ? (
        <p className="mt-3 text-xs text-muted-foreground">
          This cohort is {cohortStatus}. Only a planned or live cohort takes new
          members.
        </p>
      ) : (
        <form action={submit} className="mt-3 space-y-3">
          <input type="hidden" name="cohort_id" value={cohortId} />
          <textarea
            name="emails"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="someone@wearephlo.com&#10;someone.else@wearephlo.com"
            className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-base outline-none md:text-sm focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={submitting || text.trim() === ""}>
              <UserPlusIcon aria-hidden />
              {submitting ? "Enrolling..." : "Enrol"}
            </Button>
            {notEnrolledEmails.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setText(notEnrolledEmails.join("\n"))}
              >
                Fill with everyone not in a cohort ({notEnrolledEmails.length})
              </Button>
            )}
          </div>
        </form>
      )}

      {state.kind === "error" && (
        <p className="mt-3 text-xs text-destructive-ink">{state.message}</p>
      )}

      {state.kind === "success" && (
        <div className="mt-3 space-y-2 text-xs">
          <p className="font-medium text-foreground">{state.summary}</p>
          {state.note && <p className="text-muted-foreground">{state.note}</p>}
          {state.outcome.clashed.length > 0 && (
            <p className="text-muted-foreground">
              Already in another planned or live cohort, so not moved:{" "}
              {state.outcome.clashed.join(", ")}
            </p>
          )}
          {state.outcome.failed.length > 0 && (
            <ul className="space-y-0.5 text-destructive-ink">
              {state.outcome.failed.map((f) => (
                <li key={f.email}>
                  {f.email} - {f.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {pending.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <h4 className="text-3xs font-semibold uppercase tracking-wide text-muted-foreground">
            Waiting for a first sign-in ({pending.length})
          </h4>
          <ul className="mt-2 space-y-1">
            {pending.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 text-xs text-foreground"
              >
                <span className="truncate font-mono">{p.email}</span>
                <form action={cancel}>
                  <input type="hidden" name="pending_id" value={p.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${p.email}`}
                  >
                    <XIcon aria-hidden />
                  </Button>
                </form>
              </li>
            ))}
          </ul>
          {cancelState.kind === "error" && (
            <p className="mt-2 text-xs text-destructive-ink">
              {cancelState.message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
