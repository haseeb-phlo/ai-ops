"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
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
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TagInput } from "@/components/ui/tag-input";
import {
  PeoplePicker,
  type PickerPerson,
} from "@/components/ui/people-picker";
import {
  CADENCES,
  CADENCE_LABEL,
  isCadence,
  perWeekToCadence,
  type Cadence,
} from "@/lib/frequency";
import {
  updateWorkflow,
  type UpdateWorkflowState,
} from "../actions";

type Workflow = {
  id: string;
  name: string;
  team: string | null;
  regulatory: boolean;
  visibility: string;
  frequency_per_week: number | null;
  frequency_cadence: string | null;
  criticality_score: number | null;
  business_kpi: string | null;
  owner_names: string[];
  tools_used: string[] | null;
  notes: string | null;
};

const CRITICALITY_OPTIONS = [
  { value: "1", label: "Trivial" },
  { value: "2", label: "Low" },
  { value: "3", label: "Medium" },
  { value: "4", label: "High" },
  { value: "5", label: "Critical" },
] as const;

const TEAM_NONE = "__none__";

export function EditWorkflowDialog({
  workflow,
  teams,
  people,
  hoursPerWeek,
  toolSuggestions,
}: {
  workflow: Workflow;
  teams: string[];
  people: PickerPerson[];
  hoursPerWeek: number | null;
  toolSuggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  // Remount the inner form on each open so cancelled edits and stale
  // errors don't leak into the next session.
  const [epoch, setEpoch] = useState(0);
  const pendingRef = useRef(false);

  function handleOpenChange(next: boolean) {
    if (pendingRef.current) return;
    if (next) setEpoch((n) => n + 1);
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline">
            Edit
          </Button>
        }
      />
      <DialogContent className="gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="gap-2 px-6 pt-5 pb-5">
          <DialogTitle>Edit workflow</DialogTitle>
          <DialogDescription>
            Updates are recorded in the audit log. Fields marked * are
            required.
          </DialogDescription>
        </DialogHeader>

        <EditWorkflowForm
          key={epoch}
          workflow={workflow}
          teams={teams}
          people={people}
          hoursPerWeek={hoursPerWeek}
          toolSuggestions={toolSuggestions}
          onPendingChange={(p) => {
            pendingRef.current = p;
          }}
          onCancel={() => handleOpenChange(false)}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditWorkflowForm({
  workflow,
  teams,
  people,
  hoursPerWeek,
  toolSuggestions,
  onPendingChange,
  onCancel,
  onSaved,
}: {
  workflow: Workflow;
  teams: string[];
  people: PickerPerson[];
  hoursPerWeek: number | null;
  toolSuggestions: string[];
  onPendingChange: (pending: boolean) => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  // Initial cadence preference: stored cadence → inferred from numeric →
  // "weekly" default. Means a row created before the migration but
  // backfilled by it opens edit on its bucketed cadence.
  const initialCadence: Cadence =
    (isCadence(workflow.frequency_cadence)
      ? workflow.frequency_cadence
      : perWeekToCadence(workflow.frequency_per_week)) ?? "weekly";

  const [team, setTeam] = useState<string>(workflow.team ?? TEAM_NONE);
  const [criticality, setCriticality] = useState<string>(
    workflow.criticality_score != null ? String(workflow.criticality_score) : "3",
  );
  const [cadence, setCadence] = useState<Cadence>(initialCadence);
  const [regulatory, setRegulatory] = useState(workflow.regulatory);
  const [confidential, setConfidential] = useState(
    workflow.visibility === "team",
  );
  const [tools, setTools] = useState<string[]>(workflow.tools_used ?? []);
  const [state, setState] = useState<UpdateWorkflowState>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  // Owners: match the stored plain-text names against the company directory
  // so the picker can prefill. Names with no directory match (legacy
  // free-text entries) are preserved untouched and surfaced below the
  // picker so nothing silently disappears on save.
  const { initialOwnerEmails, unmatchedNames } = useMemo(() => {
    const emailByName = new Map<string, string>();
    for (const p of people) {
      emailByName.set(p.displayName.trim().toLowerCase(), p.email);
    }
    const matched = new Set<string>();
    const unmatched: string[] = [];
    for (const n of workflow.owner_names) {
      const email = emailByName.get(n.trim().toLowerCase());
      if (email) matched.add(email);
      else unmatched.push(n);
    }
    return { initialOwnerEmails: matched, unmatchedNames: unmatched };
  }, [people, workflow.owner_names]);

  const [owners, setOwners] = useState<Set<string>>(initialOwnerEmails);

  const nameByEmail = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of people) m.set(p.email, p.displayName);
    return m;
  }, [people]);

  // The action reads a single comma-separated "owner_names" field; keep
  // that contract and serialize picker selections (plus any preserved
  // legacy names) into it.
  const ownerNamesValue = [
    ...unmatchedNames,
    ...Array.from(owners).map((e) => nameByEmail.get(e) ?? e),
  ].join(", ");

  // React 19 auto-resets uncontrolled fields when the form action settles -
  // including on a validation error. Snapshot the FormData on submit and
  // immediately remount the uncontrolled fields with the snapshot as their
  // defaultValues; the auto-reset then restores those defaults, so the
  // user's typed input survives an error round-trip.
  const [snapshot, setSnapshot] = useState<FormData | null>(null);
  const [submitEpoch, setSubmitEpoch] = useState(0);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onPendingChange(pending);
  }, [pending, onPendingChange]);

  const d = (name: string, fallback: string): string => {
    const v = snapshot?.get(name);
    return typeof v === "string" ? v : fallback;
  };

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await updateWorkflow(workflow.id, state, formData);
      setState(result);
      if (result.kind === "success") {
        onSaved();
      } else if (result.kind === "error") {
        requestAnimationFrame(() => {
          errorRef.current?.scrollIntoView({
            block: "nearest",
            behavior: "smooth",
          });
          errorRef.current?.focus();
        });
      }
    });
  }

  // The team list may not include the workflow's current team if no other
  // workflow uses it - make sure it's always selectable.
  const teamOptions = workflow.team && !teams.includes(workflow.team)
    ? [...teams, workflow.team]
    : teams;

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        setSnapshot(new FormData(e.currentTarget));
        setSubmitEpoch((n) => n + 1);
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex-1 space-y-4 overflow-y-auto border-t border-border px-6 py-5">
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
              defaultValue={d("name", workflow.name)}
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="team">Team</Label>
            <input
              type="hidden"
              name="team"
              value={team === TEAM_NONE ? "" : team}
            />
            <Select
              value={team}
              onValueChange={(v) => setTeam(v ?? TEAM_NONE)}
            >
              <SelectTrigger id="team">
                <SelectValue>
                  {(v) => (v === TEAM_NONE ? "No team" : (v as string))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TEAM_NONE}>No team</SelectItem>
                {teamOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="frequency_cadence">
              How often does it run?
            </Label>
            <input
              type="hidden"
              name="frequency_cadence"
              value={cadence}
            />
            <Select
              value={cadence}
              onValueChange={(v) => v && setCadence(v as Cadence)}
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

          <div className="space-y-1.5">
            <Label htmlFor="hours_per_week">Hours per week</Label>
            <Input
              key={`hours_per_week-${submitEpoch}`}
              id="hours_per_week"
              name="hours_per_week"
              type="number"
              min="0"
              max="168"
              step="0.25"
              defaultValue={d(
                "hours_per_week",
                hoursPerWeek != null ? String(hoursPerWeek) : "",
              )}
              placeholder="e.g. 2"
            />
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
              onChange={setCriticality}
              options={CRITICALITY_OPTIONS.map((c) => ({
                value: c.value,
                label: c.label,
                prefix: c.value,
              }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="business_kpi">Business KPI</Label>
            <Input
              key={`business_kpi-${submitEpoch}`}
              id="business_kpi"
              name="business_kpi"
              defaultValue={d("business_kpi", workflow.business_kpi ?? "")}
              placeholder="e.g. Order accuracy"
              maxLength={500}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Owners</Label>
            <input type="hidden" name="owner_names" value={ownerNamesValue} />
            <PeoplePicker
              people={people}
              selected={owners}
              onChange={setOwners}
            />
            {unmatchedNames.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Kept from before (not in the directory):{" "}
                {unmatchedNames.join(", ")}.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Who actually does this work today, from the company directory.
            </p>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Tools used</Label>
            <TagInput
              selected={tools}
              onChange={setTools}
              suggestions={toolSuggestions}
              inputName="tools_used"
              placeholder="e.g. Notion, Claude, Linear"
            />
            <p className="text-xs leading-normal text-muted-foreground">
              Apps, AI models, or systems people use to run this. Press
              Enter or comma to add.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              id="regulatory"
              name="regulatory"
              type="checkbox"
              checked={regulatory}
              onChange={(e) => setRegulatory(e.target.checked)}
              className="size-4 rounded border-input"
            />
            <Label htmlFor="regulatory" className="font-normal">
              This workflow has regulatory implications
            </Label>
          </div>

          {workflow.regulatory && !regulatory && (
            <Alert variant="warning" className="text-xs sm:col-span-2">
              You&apos;re removing the regulatory flag.
            </Alert>
          )}

          <div className="space-y-1 sm:col-span-2">
            <div className="flex items-center gap-2">
              <input
                id="confidential"
                name="confidential"
                type="checkbox"
                checked={confidential}
                onChange={(e) => setConfidential(e.target.checked)}
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

          {workflow.visibility === "team" && !confidential && (
            <Alert variant="warning" className="text-xs sm:col-span-2">
              You&apos;re making this workflow visible to the whole company.
            </Alert>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              key={`notes-${submitEpoch}`}
              id="notes"
              name="notes"
              rows={4}
              maxLength={2000}
              defaultValue={d("notes", workflow.notes ?? "")}
              placeholder="Optional. Context, caveats, links - anything the structured fields don't capture."
            />
            <p className="text-xs text-muted-foreground">
              Plain text, line breaks preserved. Tracked in the audit log.
            </p>
          </div>
        </div>

        {state.kind === "error" && (
          <Alert variant="destructive" ref={errorRef} tabIndex={-1}>
            {state.message}
          </Alert>
        )}
      </div>

      <DialogFooter className="m-0 border-t border-border bg-muted/40 px-6 py-3">
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
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
