"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  hoursPerWeek,
  toolSuggestions,
}: {
  workflow: Workflow;
  teams: string[];
  hoursPerWeek: number | null;
  toolSuggestions: string[];
}) {
  // Initial cadence preference: stored cadence → inferred from numeric →
  // "weekly" default. Means a row created before the migration but
  // backfilled by it opens edit on its bucketed cadence.
  const initialCadence: Cadence =
    (isCadence(workflow.frequency_cadence)
      ? workflow.frequency_cadence
      : perWeekToCadence(workflow.frequency_per_week)) ?? "weekly";

  const [open, setOpen] = useState(false);
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

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await updateWorkflow(workflow.id, state, formData);
      setState(result);
      if (result.kind === "success") setOpen(false);
    });
  }

  // Reset local state to the workflow's current values whenever the dialog
  // opens, so cancelling and reopening doesn't show stale edits.
  function handleOpenChange(next: boolean) {
    if (next) {
      setTeam(workflow.team ?? TEAM_NONE);
      setCriticality(
        workflow.criticality_score != null
          ? String(workflow.criticality_score)
          : "3",
      );
      setCadence(initialCadence);
      setRegulatory(workflow.regulatory);
      setConfidential(workflow.visibility === "team");
      setTools(workflow.tools_used ?? []);
    }
    setOpen(next);
  }

  // The team list may not include the workflow's current team if no other
  // workflow uses it - make sure it's always selectable.
  const teamOptions = workflow.team && !teams.includes(workflow.team)
    ? [...teams, workflow.team]
    : teams;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        type="button"
        variant="outline"
        onClick={() => handleOpenChange(true)}
      >
        Edit
      </Button>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="gap-2 px-6 pt-5 pb-5">
          <DialogTitle>Edit workflow</DialogTitle>
          <DialogDescription>
            Updates are recorded in the audit log.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto border-t border-border px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="name">Workflow name</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  defaultValue={workflow.name}
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
                  id="hours_per_week"
                  name="hours_per_week"
                  type="number"
                  min="0"
                  max="168"
                  step="0.25"
                  defaultValue={
                    hoursPerWeek != null ? String(hoursPerWeek) : ""
                  }
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
                    suffix: c.value,
                  }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="business_kpi">Business KPI</Label>
                <Input
                  id="business_kpi"
                  name="business_kpi"
                  defaultValue={workflow.business_kpi ?? ""}
                  placeholder="e.g. Order accuracy"
                  maxLength={500}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="owner_names">Owners</Label>
                <Input
                  id="owner_names"
                  name="owner_names"
                  defaultValue={workflow.owner_names.join(", ")}
                  placeholder="Comma-separated, e.g. Aisha Khan, Marcus Lee"
                />
                <p className="text-xs text-muted-foreground">
                  Plain text names, separated by commas.
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
                <p className="text-xs text-muted-foreground">
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
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="regulatory" className="font-normal">
                  This workflow has regulatory implications
                </Label>
              </div>

              {workflow.regulatory && !regulatory && (
                <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900 sm:col-span-2">
                  You&apos;re removing the regulatory flag.
                </p>
              )}

              <div className="space-y-1 sm:col-span-2">
                <div className="flex items-center gap-2">
                  <input
                    id="confidential"
                    name="confidential"
                    type="checkbox"
                    checked={confidential}
                    onChange={(e) => setConfidential(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="confidential" className="font-normal">
                    Confidential &mdash; only visible to the owner team
                  </Label>
                </div>
                <p className="pl-6 text-xs text-muted-foreground">
                  Hides this workflow (and its steps, metrics and activity)
                  from everyone outside the owner team, except admins.
                </p>
              </div>

              {workflow.visibility === "team" && !confidential && (
                <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900 sm:col-span-2">
                  You&apos;re making this workflow visible to the whole
                  company.
                </p>
              )}

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  maxLength={2000}
                  defaultValue={workflow.notes ?? ""}
                  placeholder="Optional. Context, caveats, links - anything the structured fields don't capture."
                />
                <p className="text-xs text-muted-foreground">
                  Plain text, line breaks preserved. Tracked in the audit log.
                </p>
              </div>
            </div>

            {state.kind === "error" && (
              <p
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {state.message}
              </p>
            )}
          </div>

          <DialogFooter className="m-0 border-t border-border bg-muted/40 px-6 py-3">
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={pending}>
                  Cancel
                </Button>
              }
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
