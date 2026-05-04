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
import {
  updateWorkflow,
  type UpdateWorkflowState,
} from "../actions";

type Workflow = {
  id: string;
  name: string;
  team: string | null;
  regulatory: boolean;
  frequency: string | null;
  criticality: "low" | "medium" | "high" | "critical" | null;
  business_kpi: string | null;
  owner_names: string[];
};

const CRITICALITIES: Workflow["criticality"][] = [
  "low",
  "medium",
  "high",
  "critical",
];

const TEAM_NONE = "__none__";
const CRIT_NONE = "__none__";

export function EditWorkflowDialog({
  workflow,
  teams,
}: {
  workflow: Workflow;
  teams: string[];
}) {
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState<string>(workflow.team ?? TEAM_NONE);
  const [criticality, setCriticality] = useState<string>(
    workflow.criticality ?? CRIT_NONE,
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
      setCriticality(workflow.criticality ?? CRIT_NONE);
      setRegulatory(workflow.regulatory);
    }
    setOpen(next);
  }

  // The team list may not include the workflow's current team if no other
  // workflow uses it — make sure it's always selectable.
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
            Updates are recorded in the audit log. Steps are edited in the table
            below.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Workflow name</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={workflow.name}
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
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

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Input
                id="frequency"
                name="frequency"
                defaultValue={workflow.frequency ?? ""}
                placeholder="e.g. weekly, daily, ad-hoc"
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="criticality">Criticality</Label>
              <input
                type="hidden"
                name="criticality"
                value={criticality === CRIT_NONE ? "" : criticality}
              />
              <Select
                value={criticality}
                onValueChange={(v) => setCriticality(v ?? CRIT_NONE)}
              >
                <SelectTrigger id="criticality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CRIT_NONE}>Unset</SelectItem>
                  {CRITICALITIES.map((c) => (
                    <SelectItem key={c!} value={c!}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="business_kpi">Business KPI</Label>
              <Input
                id="business_kpi"
                name="business_kpi"
                defaultValue={workflow.business_kpi ?? ""}
                placeholder="e.g. Order accuracy"
                maxLength={500}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="owner_names">Owners</Label>
              <Input
                id="owner_names"
                name="owner_names"
                defaultValue={workflow.owner_names.join(", ")}
                placeholder="Comma-separated, e.g. Aisha Khan, Marcus Lee"
              />
              <p className="text-xs text-zinc-500">
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
                className="h-4 w-4 rounded border-zinc-300"
              />
              <Label htmlFor="regulatory" className="font-normal">
                This workflow has regulatory implications
              </Label>
            </div>

            {workflow.regulatory && !regulatory && (
              <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900 sm:col-span-2">
                You&apos;re removing the regulatory flag. Make sure that&apos;s
                intentional — regulatory_events are still tracked separately.
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
