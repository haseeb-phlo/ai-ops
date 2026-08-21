"use client";

import { useActionState, useState } from "react";
import { CheckIcon, CopyIcon, PlusIcon, SendIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deriveSessionDates,
  generateJoinCode,
  upcomingMondays,
  type SessionItemRef,
} from "@/lib/programme/cohort-setup";
import {
  createCohort,
  updateCohort,
  type CohortActionState,
} from "../_actions/cohorts";
import { sendSlackTest, type SlackTestState } from "../_actions/slack-test";

export type ExistingCohort = {
  id: string;
  name: string;
  status: string;
  startDate: string;
  isTest: boolean;
  joinCode: string | null;
  joinOpen: boolean;
  slackChannel: string | null;
  defaultApproverUserId: string | null;
  memberCount: number;
};

export type ApproverOption = { userId: string; displayName: string };

/**
 * Create and manage cohorts.
 *
 * The create form derives rather than asks: pick a start Monday and it works
 * out which items are sessions and what dates they land on. That matters
 * because `session_dates` is stored as JSON keyed by track item UUID, and a
 * form that made an admin assemble that by hand would be no better than
 * writing the INSERT.
 */
export function CohortManager({
  cohorts,
  sessions,
  today,
  approvers,
  meUserId,
}: {
  cohorts: ExistingCohort[];
  sessions: SessionItemRef[];
  today: string;
  approvers: ApproverOption[];
  meUserId: string;
}) {
  return (
    <div className="space-y-6">
      <CreateCohortForm
        sessions={sessions}
        today={today}
        approvers={approvers}
        meUserId={meUserId}
      />
      <ExistingCohorts cohorts={cohorts} approvers={approvers} />
    </div>
  );
}

/**
 * Who signs off every submission in this cohort.
 *
 * Left unset, routing falls to ORG_TREE - which sends every exec to the CEO,
 * so an exec cohort would land forty sign-offs on someone who never agreed
 * to them. Naming one person here overrides the tree for the whole cohort.
 */
function ApproverField({
  approvers,
  defaultValue,
  id,
  compact = false,
}: {
  approvers: ApproverOption[];
  defaultValue: string | null;
  id?: string;
  compact?: boolean;
}) {
  return (
    <select
      id={id}
      name="default_approver_user_id"
      defaultValue={defaultValue ?? ""}
      className={cn(
        "rounded-lg border border-border bg-background px-2 text-sm",
        compact ? "h-8 w-48" : "h-9 w-full",
      )}
    >
      <option value="">Follow the org chart</option>
      {approvers.map((a) => (
        <option key={a.userId} value={a.userId}>
          {a.displayName}
        </option>
      ))}
    </select>
  );
}

function CreateCohortForm({
  sessions,
  today,
  approvers,
  meUserId,
}: {
  sessions: SessionItemRef[];
  today: string;
  approvers: ApproverOption[];
  meUserId: string;
}) {
  const [state, action, pending] = useActionState<CohortActionState, FormData>(
    createCohort,
    { kind: "idle" },
  );
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const mondays = upcomingMondays(today, 8);
  const [startDate, setStartDate] = useState(mondays[0]);
  const [dualSlots, setDualSlots] = useState<Set<string>>(new Set());
  const [code, setCode] = useState("");

  const derived = deriveSessionDates({
    startDate,
    sessions,
    dualSlotItemIds: dualSlots,
  });

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden />
        New cohort
      </Button>
    );
  }

  if (state.kind === "success") {
    return (
      <div className="rounded-lg border border-border bg-background p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CheckIcon className="size-4 text-success" aria-hidden />
          Cohort created.
        </p>
        {state.joinCode && (
          <p className="mt-2 text-sm text-muted-foreground">
            Share this in the cohort channel and people enrol themselves:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
              /learn/join?code={state.joinCode}
            </code>
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5 rounded-lg border border-border bg-background p-4">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">
        New cohort
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cohort 1"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="start_date">Starts</Label>
          <select
            id="start_date"
            name="start_date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground"
          >
            {mondays.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Mondays only, so day 1 is the first working day.
          </p>
        </div>
      </div>

      {/* Derived, not asked for. */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-foreground">
          Session dates
        </legend>
        <p className="text-xs text-muted-foreground">
          Worked out from the start date. Tick a session to run it twice, for
          people who cannot all leave the floor at once.
        </p>
        <ul className="space-y-1.5">
          {derived.map((session) => (
            <li
              key={session.trackItemId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
            >
              <span className="text-sm text-foreground">{session.title}</span>
              <span className="flex items-center gap-3">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {session.dates.join("  ·  ")}
                </span>
                <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    name="dual_slot"
                    value={session.trackItemId}
                    checked={dualSlots.has(session.trackItemId)}
                    onChange={(e) =>
                      setDualSlots((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(session.trackItemId);
                        else next.delete(session.trackItemId);
                        return next;
                      })
                    }
                  />
                  two slots
                </label>
              </span>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="join_code">Join code</Label>
          <div className="flex gap-2">
            <Input
              id="join_code"
              name="join_code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="PHLO-C1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCode(generateJoinCode(name || "Phlo"))}
            >
              Generate
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            People enter this at /learn/join to enrol themselves.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slack_channel">Slack channel</Label>
          <Input
            id="slack_channel"
            name="slack_channel"
            placeholder="ai-cohort-1"
          />
          <p className="text-xs text-muted-foreground">
            Where completions get announced. Paste the name or the channel
            link; invite the AI Ops bot to it first.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="default_approver_user_id">Who signs off work</Label>
          <ApproverField
            id="default_approver_user_id"
            approvers={approvers}
            defaultValue={meUserId}
          />
          <p className="text-xs text-muted-foreground">
            One person reviews every submission in this cohort. Leave it on the
            org chart only once team leads have been through the programme
            themselves.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm text-foreground">
          <span className="text-muted-foreground">Status</span>
          <select
            name="status"
            defaultValue="planned"
            className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
          >
            <option value="planned">Planned</option>
            <option value="live">Live</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="is_test" />
          Test cohort (excluded from all reporting)
        </label>
      </div>

      {state.kind === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create cohort"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ExistingCohorts({
  cohorts,
  approvers,
}: {
  cohorts: ExistingCohort[];
  approvers: ApproverOption[];
}) {
  if (cohorts.length === 0) return null;
  return (
    <ul className="space-y-3">
      {cohorts.map((c) => (
        <CohortRow key={c.id} cohort={c} approvers={approvers} />
      ))}
    </ul>
  );
}

function CohortRow({
  cohort,
  approvers,
}: {
  cohort: ExistingCohort;
  approvers: ApproverOption[];
}) {
  const [state, action, pending] = useActionState<CohortActionState, FormData>(
    updateCohort,
    { kind: "idle" },
  );
  const [copied, setCopied] = useState(false);

  const joinUrl = cohort.joinCode
    ? `${typeof window === "undefined" ? "" : window.location.origin}/learn/join?code=${cohort.joinCode}`
    : null;

  return (
    <li className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-foreground">
          {cohort.name}
          {cohort.isTest && (
            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-3xs uppercase tracking-wide text-muted-foreground">
              test
            </span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {cohort.memberCount} member{cohort.memberCount === 1 ? "" : "s"} ·
          starts {cohort.startDate}
        </span>
      </div>

      {cohort.joinCode && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
            {cohort.joinCode}
          </code>
          <span
            className={cn(
              "text-xs",
              cohort.joinOpen ? "text-muted-foreground" : "text-warning",
            )}
          >
            {cohort.joinOpen ? "open for joining" : "closed"}
          </span>
          {joinUrl && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                void navigator.clipboard.writeText(joinUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
            >
              {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
              {copied ? "Copied" : "Copy join link"}
            </Button>
          )}
        </div>
      )}

      <SlackTest cohortId={cohort.id} channel={cohort.slackChannel} />

      <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="cohort_id" value={cohort.id} />
        <label className="space-y-1 text-xs">
          <span className="block text-muted-foreground">Status</span>
          <select
            name="status"
            defaultValue={cohort.status}
            className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
          >
            <option value="planned">Planned</option>
            <option value="live">Live</option>
            <option value="complete">Complete</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="block text-muted-foreground">Slack channel</span>
          <Input
            name="slack_channel"
            defaultValue={cohort.slackChannel ?? ""}
            placeholder="ai-cohort-1"
            className="w-48"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="block text-muted-foreground">Signs off work</span>
          <ApproverField
            approvers={approvers}
            defaultValue={cohort.defaultApproverUserId}
            compact
          />
        </label>
        <label className="inline-flex items-center gap-1.5 pb-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            name="join_open"
            defaultChecked={cohort.joinOpen}
          />
          accepting joins
        </label>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state.kind === "error" && (
          <span className="text-xs text-destructive">{state.message}</span>
        )}
        {state.kind === "success" && (
          <span className="text-xs text-muted-foreground">Saved.</span>
        )}
      </form>
    </li>
  );
}

/**
 * Sends a real message to the configured channel.
 *
 * The three ways this breaks - wrong channel name, bot not invited, missing
 * scope - are indistinguishable until something tries to post, and in
 * production they all fail the same way: silently, to nobody. Better to find
 * out here.
 */
function SlackTest({
  cohortId,
  channel,
}: {
  cohortId: string;
  channel: string | null;
}) {
  const [state, action, pending] = useActionState<SlackTestState, FormData>(
    sendSlackTest,
    { kind: "idle" },
  );

  // Rendered even with no channel set. Hiding it until one is saved put the
  // affordance behind exactly the step it exists to verify, so nobody found it.
  if (!channel) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        Add a Slack channel below and save, then a test button appears here.
      </p>
    );
  }

  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="cohort_id" value={cohortId} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="outline" size="xs" disabled={pending}>
          <SendIcon aria-hidden />
          {pending ? "Sending..." : `Send a test to #${channel}`}
        </Button>
        {state.kind === "success" && (
          <span className="text-xs text-success">
            Posted. Check #{state.channel}.
          </span>
        )}
      </div>
      {state.kind === "error" && (
        <p className="max-w-prose rounded-md border border-border border-l-2 border-l-warning bg-background px-3 py-2 text-xs text-foreground">
          {state.message}
        </p>
      )}
    </form>
  );
}
