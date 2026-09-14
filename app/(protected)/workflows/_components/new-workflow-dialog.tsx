"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PeoplePicker,
  type PickerPerson,
} from "@/components/ui/people-picker";
import { TagInput } from "@/components/ui/tag-input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { CADENCES, CADENCE_LABEL, type Cadence } from "@/lib/frequency";
import { createWorkflow, type CreateWorkflowState } from "../actions";
import { StepEditor } from "./step-editor";

const CRITICALITY = [
  { value: "1", label: "Trivial" },
  { value: "2", label: "Low" },
  { value: "3", label: "Medium" },
  { value: "4", label: "High" },
  { value: "5", label: "Critical" },
] as const;

export function NewWorkflowDialog({
  teams,
  defaultTeam,
  people,
  toolSuggestions = [],
}: {
  teams: string[];
  defaultTeam: string;
  people: PickerPerson[];
  toolSuggestions?: string[];
}) {
  const [open, setOpen] = useState(false);
  // Remounting the inner form on every open gives it fresh useActionState +
  // field state, so a stale error / half-typed draft never leaks into the
  // next session.
  const [epoch, setEpoch] = useState(0);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirtyRef = useRef(false);
  const pendingRef = useRef(false);

  function handleOpenChange(next: boolean) {
    if (pendingRef.current) return;
    if (!next && dirtyRef.current) {
      // Close attempt (Escape / backdrop / Cancel) with unsaved input:
      // require an explicit discard first.
      setConfirmDiscard(true);
      return;
    }
    if (next) {
      setEpoch((n) => n + 1);
      dirtyRef.current = false;
    }
    setOpen(next);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger render={<Button>Add new workflow</Button>} />
        <DialogContent className="gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="gap-2 px-6 pt-5 pb-5">
            <DialogTitle>Add new workflow</DialogTitle>
            <DialogDescription>
              Describe how this work gets done today and list the steps in
              order. You can edit, reorder, or add detail later. Fields marked
              * are required.
            </DialogDescription>
          </DialogHeader>

          <NewWorkflowForm
            key={epoch}
            teams={teams}
            defaultTeam={defaultTeam}
            people={people}
            toolSuggestions={toolSuggestions}
            onDirty={() => {
              dirtyRef.current = true;
            }}
            onPendingChange={(p) => {
              pendingRef.current = p;
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Discard this draft?</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Closing now loses everything
              you&apos;ve entered.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmDiscard(false)}
            >
              Keep editing
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirmDiscard(false);
                dirtyRef.current = false;
                setOpen(false);
              }}
            >
              Discard draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewWorkflowForm({
  teams,
  defaultTeam,
  people,
  toolSuggestions,
  onDirty,
  onPendingChange,
}: {
  teams: string[];
  defaultTeam: string;
  people: PickerPerson[];
  toolSuggestions: string[];
  onDirty: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [team, setTeam] = useState(defaultTeam);
  const [criticality, setCriticality] = useState("3");
  const [cadence, setCadence] = useState<Cadence>("weekly");
  const [owners, setOwners] = useState<Set<string>>(new Set());
  const [tools, setTools] = useState<string[]>([]);
  const [stepCount, setStepCount] = useState(0);

  const [state, action, pending] = useActionState<CreateWorkflowState, FormData>(
    createWorkflow,
    { kind: "idle" },
  );

  // React 19 auto-resets uncontrolled fields after a form action settles -
  // including when the action returns a validation error. Snapshot the
  // FormData on submit and immediately remount the uncontrolled fields with
  // the snapshot as their defaultValues; the auto-reset then restores those
  // defaults, so the user never loses typed input to a validation error.
  const [snapshot, setSnapshot] = useState<FormData | null>(null);
  const [submitEpoch, setSubmitEpoch] = useState(0);
  const errorRef = useRef<HTMLDivElement>(null);

  // On error, bring the alert into view and focus it (it renders at the
  // bottom of a long scroll area).
  useEffect(() => {
    if (state.kind === "error") {
      errorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      errorRef.current?.focus();
    }
  }, [state]);

  useEffect(() => {
    onPendingChange(pending);
  }, [pending, onPendingChange]);

  const d = (name: string): string | undefined => {
    const v = snapshot?.get(name);
    return typeof v === "string" ? v : undefined;
  };

  const missing: string[] = [];
  if (owners.size === 0) missing.push("pick at least one person involved");
  if (stepCount === 0) missing.push("add at least one step");
  const hintId = "new-workflow-missing-hint";

  return (
    <form
      action={action}
      onSubmit={(e) => {
        setSnapshot(new FormData(e.currentTarget));
        setSubmitEpoch((n) => n + 1);
      }}
      onChange={onDirty}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex-1 space-y-6 overflow-y-auto border-t border-border px-6 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">
              Workflow name
              <RequiredMark />
            </Label>
            <Input
              key={`name-${submitEpoch}`}
              id="name"
              name="name"
              required
              defaultValue={d("name")}
              placeholder="e.g. Weekly stock count"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="team">
              Owner team
              <RequiredMark />
            </Label>
            <input type="hidden" name="team" value={team} required />
            <Select
              value={team}
              onValueChange={(v) => {
                onDirty();
                setTeam(v ?? "");
              }}
            >
              <SelectTrigger id="team" className="w-full" aria-required="true">
                <SelectValue placeholder="Pick a team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
                {teams.length === 0 && defaultTeam && (
                  <SelectItem value={defaultTeam}>{defaultTeam}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="frequency_cadence">How often does it run?</Label>
            <input
              type="hidden"
              name="frequency_cadence"
              value={cadence}
            />
            <Select
              value={cadence}
              onValueChange={(v) => {
                if (!v) return;
                onDirty();
                setCadence(v as Cadence);
              }}
            >
              <SelectTrigger id="frequency_cadence" className="w-full">
                <SelectValue>
                  {(v) => (v ? CADENCE_LABEL[v as Cadence] ?? "" : null)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CADENCES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CADENCE_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Criticality</Label>
            <input
              type="hidden"
              name="criticality_score"
              value={criticality}
            />
            <SegmentedControl
              value={criticality}
              onChange={(v) => {
                onDirty();
                setCriticality(v);
              }}
              options={CRITICALITY.map((c) => ({
                value: c.value,
                label: c.label,
                prefix: c.value,
              }))}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="business_kpi">
              Business KPI
              <RequiredMark />
            </Label>
            <Input
              key={`business_kpi-${submitEpoch}`}
              id="business_kpi"
              name="business_kpi"
              required
              defaultValue={d("business_kpi")}
              placeholder="e.g. Order accuracy"
            />
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              key={`regulatory_flag-${submitEpoch}`}
              id="regulatory_flag"
              name="regulatory_flag"
              type="checkbox"
              defaultChecked={d("regulatory_flag") === "on"}
              className="size-4 rounded border-input"
            />
            <Label htmlFor="regulatory_flag" className="font-normal">
              This workflow has regulatory implications
            </Label>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <div className="flex items-center gap-2">
              <input
                key={`confidential-${submitEpoch}`}
                id="confidential"
                name="confidential"
                type="checkbox"
                defaultChecked={d("confidential") === "on"}
                className="size-4 rounded border-input"
              />
              <Label htmlFor="confidential" className="font-normal">
                Confidential &mdash; only visible to the owner team
              </Label>
            </div>
            <p className="pl-6 text-xs leading-normal text-muted-foreground">
              Hides this workflow (and its steps, metrics and activity) from
              everyone outside the owner team, except admins.
            </p>
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <div className="space-y-1">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              People involved
              <RequiredMark />
            </h3>
            <p className="text-xs leading-normal text-muted-foreground">
              Who actually does this work today? Pick at least one person
              from the company directory. You can adjust later from the
              workflow page.
            </p>
          </div>
          <PeoplePicker
            people={people}
            selected={owners}
            onChange={(next) => {
              onDirty();
              setOwners(next);
            }}
            inputName="owner_emails"
          />
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <div className="space-y-1">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tools used
            </h3>
            <p className="text-xs leading-normal text-muted-foreground">
              Apps, AI models, or systems people use to run this today.
              Optional. Press Enter or comma to add.
            </p>
          </div>
          <TagInput
            selected={tools}
            onChange={(next) => {
              onDirty();
              setTools(next);
            }}
            suggestions={toolSuggestions}
            inputName="tools_used"
            placeholder="e.g. Notion, Claude, Linear"
          />
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <div className="space-y-1">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Today&apos;s baseline
              <RequiredMark />
            </h3>
            <p className="text-xs leading-normal text-muted-foreground">
              Roughly what this currently consumes per week. AI savings get
              measured against these. Enter 0 if a number doesn&apos;t apply.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="hours_per_week">Hours</Label>
              <SuffixInput suffix="/ wk">
                <Input
                  key={`hours_per_week-${submitEpoch}`}
                  id="hours_per_week"
                  name="hours_per_week"
                  type="number"
                  min="0"
                  step="0.5"
                  required
                  defaultValue={d("hours_per_week")}
                />
              </SuffixInput>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cost_per_week">Cost</Label>
              <PrefixInput prefix="£">
                <SuffixInput suffix="/ wk">
                  <Input
                    key={`cost_per_week-${submitEpoch}`}
                    id="cost_per_week"
                    name="cost_per_week"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    defaultValue={d("cost_per_week")}
                  />
                </SuffixInput>
              </PrefixInput>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="revenue_per_week">Revenue generated</Label>
              <PrefixInput prefix="£">
                <SuffixInput suffix="/ wk">
                  <Input
                    key={`revenue_per_week-${submitEpoch}`}
                    id="revenue_per_week"
                    name="revenue_per_week"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    defaultValue={d("revenue_per_week")}
                  />
                </SuffixInput>
              </PrefixInput>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <div className="space-y-1">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Steps
              <RequiredMark />
            </h3>
            <p className="text-xs leading-normal text-muted-foreground">
              The actions someone takes to complete this workflow, in
              order. At least one is required.
            </p>
          </div>
          <StepEditor onCountChange={setStepCount} />
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <div className="space-y-1">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Notes
            </h3>
            <p className="text-xs leading-normal text-muted-foreground">
              Optional. Anything reviewers should know &mdash; context,
              caveats, links. Plain text, line breaks preserved.
            </p>
          </div>
          <Textarea
            key={`notes-${submitEpoch}`}
            id="notes"
            name="notes"
            rows={4}
            maxLength={2000}
            defaultValue={d("notes")}
            placeholder="e.g. We pause this during quarter-end close. Spec lives in Notion → Ops handbook."
          />
        </div>

        {state.kind === "error" && (
          <Alert variant="destructive" ref={errorRef} tabIndex={-1}>
            {state.message}
          </Alert>
        )}
      </div>

      <DialogFooter className="m-0 border-t border-border bg-muted/40 px-6 py-3">
        {missing.length > 0 && (
          <p
            id={hintId}
            className="self-center text-xs text-muted-foreground sm:mr-auto"
          >
            To create: {missing.join(", ")}.
          </p>
        )}
        <DialogClose
          render={
            <Button type="button" variant="ghost" disabled={pending}>
              Cancel
            </Button>
          }
        />
        <Button
          type="submit"
          disabled={pending || missing.length > 0}
          aria-describedby={missing.length > 0 ? hintId : undefined}
        >
          {pending ? "Creating…" : "Create workflow"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function RequiredMark() {
  return (
    <span aria-hidden className="text-destructive">
      {" "}
      *
    </span>
  );
}

function PrefixInput({
  prefix,
  children,
}: {
  prefix: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        {prefix}
      </span>
      <div className="[&_input]:pl-6">{children}</div>
    </div>
  );
}

function SuffixInput({
  suffix,
  children,
}: {
  suffix: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div className="[&_input]:pr-12">{children}</div>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
        {suffix}
      </span>
    </div>
  );
}
