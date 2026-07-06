"use client";

import { useActionState, useState } from "react";
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Add new workflow</Button>} />
      <DialogContent className="gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="gap-2 px-6 pt-5 pb-5">
          <DialogTitle>Add new workflow</DialogTitle>
          <DialogDescription>
            Describe how this work gets done today and list the steps in
            order. You can edit, reorder, or add detail later.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto border-t border-border px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="name">Workflow name</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  placeholder="e.g. Weekly stock count"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="team">Owner team</Label>
                <input type="hidden" name="team" value={team} required />
                <Select value={team} onValueChange={(v) => setTeam(v ?? "")}>
                  <SelectTrigger id="team" className="w-full">
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
                  options={CRITICALITY.map((c) => ({
                    value: c.value,
                    label: c.label,
                    suffix: c.value,
                  }))}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="business_kpi">Business KPI</Label>
                <Input
                  id="business_kpi"
                  name="business_kpi"
                  required
                  placeholder="e.g. Order accuracy"
                />
              </div>

              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  id="regulatory_flag"
                  name="regulatory_flag"
                  type="checkbox"
                  className="size-4 rounded border-input"
                />
                <Label htmlFor="regulatory_flag" className="font-normal">
                  This workflow has regulatory implications
                </Label>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <div className="flex items-center gap-2">
                  <input
                    id="confidential"
                    name="confidential"
                    type="checkbox"
                    className="size-4 rounded border-input"
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
            </div>

            <div className="space-y-3 border-t border-border pt-5">
              <div className="space-y-1">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  People involved
                </h3>
                <p className="text-xs text-muted-foreground">
                  Who actually does this work today? Pick at least one person
                  from the company directory. You can adjust later from the
                  workflow page.
                </p>
              </div>
              <PeoplePicker
                people={people}
                selected={owners}
                onChange={setOwners}
                inputName="owner_emails"
              />
            </div>

            <div className="space-y-3 border-t border-border pt-5">
              <div className="space-y-1">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tools used
                </h3>
                <p className="text-xs text-muted-foreground">
                  Apps, AI models, or systems people use to run this today.
                  Optional. Press Enter or comma to add.
                </p>
              </div>
              <TagInput
                selected={tools}
                onChange={setTools}
                suggestions={toolSuggestions}
                inputName="tools_used"
                placeholder="e.g. Notion, Claude, Linear"
              />
            </div>

            <div className="space-y-3 border-t border-border pt-5">
              <div className="space-y-1">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Today&apos;s baseline
                </h3>
                <p className="text-xs text-muted-foreground">
                  Roughly what this currently consumes per week. AI savings get
                  measured against these. Enter 0 if a number doesn&apos;t apply.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="hours_per_week">Hours</Label>
                  <SuffixInput suffix="/ wk">
                    <Input
                      id="hours_per_week"
                      name="hours_per_week"
                      type="number"
                      min="0"
                      step="0.5"
                      required
                      placeholder="0"
                    />
                  </SuffixInput>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cost_per_week">Cost</Label>
                  <PrefixInput prefix="£">
                    <SuffixInput suffix="/ wk">
                      <Input
                        id="cost_per_week"
                        name="cost_per_week"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        placeholder="0"
                      />
                    </SuffixInput>
                  </PrefixInput>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="revenue_per_week">Revenue generated</Label>
                  <PrefixInput prefix="£">
                    <SuffixInput suffix="/ wk">
                      <Input
                        id="revenue_per_week"
                        name="revenue_per_week"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        placeholder="0"
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
                </h3>
                <p className="text-xs text-muted-foreground">
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
                <p className="text-xs text-muted-foreground">
                  Optional. Anything reviewers should know &mdash; context,
                  caveats, links. Plain text, line breaks preserved.
                </p>
              </div>
              <Textarea
                id="notes"
                name="notes"
                rows={4}
                maxLength={2000}
                placeholder="e.g. We pause this during quarter-end close. Spec lives in Notion → Ops handbook."
              />
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
                <Button type="button" variant="ghost" disabled={pending}>
                  Cancel
                </Button>
              }
            />
            <Button
              type="submit"
              disabled={pending || owners.size === 0 || stepCount === 0}
            >
              {pending ? "Creating…" : "Create workflow"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {suffix}
      </span>
    </div>
  );
}
