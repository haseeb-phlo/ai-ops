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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  updateWorkflow,
  type UpdateWorkflowState,
} from "../actions";

type Workflow = {
  id: string;
  name: string;
  team: string | null;
  regulatory: boolean;
  frequency_per_week: number | null;
  criticality_score: number | null;
  business_kpi: string | null;
  owner_names: string[];
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
}: {
  workflow: Workflow;
  teams: string[];
  hoursPerWeek: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState<string>(workflow.team ?? TEAM_NONE);
  const [criticality, setCriticality] = useState<string>(
    workflow.criticality_score != null ? String(workflow.criticality_score) : "3",
  );
  const [regulatory, setRegulatory] = useState(workflow.regulatory);
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
      setRegulatory(workflow.regulatory);
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit workflow</DialogTitle>
          <DialogDescription>
            Updates are recorded in the audit log.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
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
              <Select value={team} onValueChange={(v) => setTeam(v ?? TEAM_NONE)}>
                <SelectTrigger id="team">
                  <SelectValue />
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
              <Label htmlFor="frequency_per_week">Frequency per week</Label>
              <Input
                id="frequency_per_week"
                name="frequency_per_week"
                type="number"
                min="0"
                step="0.5"
                defaultValue={
                  workflow.frequency_per_week != null
                    ? String(workflow.frequency_per_week)
                    : ""
                }
                placeholder="e.g. 5"
              />
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
                defaultValue={hoursPerWeek != null ? String(hoursPerWeek) : ""}
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
              <div className="flex w-full rounded-lg border border-border bg-background p-0.5">
                {CRITICALITY_OPTIONS.map((o) => {
                  const active = criticality === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setCriticality(o.value)}
                      className={cn(
                        "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "mr-1 font-mono text-[10px]",
                          active ? "opacity-60" : "opacity-50",
                        )}
                      >
                        {o.value}
                      </span>
                      {o.label}
                    </button>
                  );
                })}
              </div>
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
          </div>

          {state.kind === "error" && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {state.message}
            </p>
          )}

          <DialogFooter>
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
