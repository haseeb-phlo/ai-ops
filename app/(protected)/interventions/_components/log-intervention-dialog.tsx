"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { logIntervention, type LogInterventionState } from "../actions";

const TYPES = [
  { value: "tool", label: "Tool" },
  { value: "training", label: "Training" },
  { value: "prompt", label: "Prompt" },
  { value: "agent", label: "Agent" },
  { value: "automation", label: "Automation" },
  { value: "process_change", label: "Process change" },
] as const;

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TYPES.map((t) => [t.value, t.label]),
);

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "High - clean before/after, isolated change",
  medium: "Medium - confounded by other changes",
  low: "Low - best-guess; many things moved at once",
};

const ADOPTION_LABEL: Record<string, string> = {
  daily: "Daily - used every day",
  weekly: "Weekly - used a few times a week",
  occasional: "Occasional - used now and then",
  abandoned: "Abandoned - nobody's using it",
};

const SATISFACTION_LABEL: Record<string, string> = {
  "1": "1 - Hate it",
  "2": "2 - Don't like it",
  "3": "3 - Neutral",
  "4": "4 - Like it",
  "5": "5 - Love it",
};

export function LogInterventionDialog({
  open,
  onOpenChange,
  workflows,
  people,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflows: { id: string; name: string }[];
  people: PickerPerson[];
}) {
  const [state, formAction] = useActionState<LogInterventionState, FormData>(
    logIntervention,
    { kind: "idle" },
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [type, setType] = useState<string>("");
  const [confidence, setConfidence] = useState<string>("high");
  const [adoption, setAdoption] = useState<string>("");
  const [satisfaction, setSatisfaction] = useState<string>("");
  const [recipients, setRecipients] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSelected(new Set());
      setType("");
      setConfidence("high");
      setAdoption("");
      setSatisfaction("");
      setRecipients(new Set());
      setSearch("");
    }
    onOpenChange(next);
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredWorkflows = workflows.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase()),
  );

  const isComplete =
    type !== "" &&
    selected.size > 0 &&
    recipients.size > 0 &&
    adoption !== "" &&
    satisfaction !== "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="gap-2 px-6 pt-5 pb-5">
          <DialogTitle>Log new intervention</DialogTitle>
          <DialogDescription>
            A tool, prompt, training session, or process change you&apos;ve
            shipped. We snapshot each affected workflow&apos;s current numbers
            as the baseline.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto border-t border-border px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  maxLength={200}
                  placeholder="e.g. Stock-count co-pilot"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="type">Type</Label>
                <input type="hidden" name="type" value={type} required />
                <Select value={type} onValueChange={(v) => setType(v ?? "")}>
                  <SelectTrigger id="type" className="w-full">
                    <SelectValue placeholder="Pick one">
                      {(v) => (v ? TYPE_LABEL[v as string] ?? "" : null)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={2}
                  required
                  minLength={3}
                  maxLength={500}
                  placeholder="One-line summary of what you shipped."
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-5">
              <div className="space-y-1">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Affected workflows
                </h3>
                <p className="text-xs text-muted-foreground">
                  Pick at least one. Each gets a baseline snapshot now.
                </p>
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                {workflows.length > 6 && (
                  <div className="border-b border-border bg-muted/40 px-3 py-1.5">
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search workflows"
                      className="h-7 border-0 bg-transparent px-0 focus-visible:ring-0"
                    />
                  </div>
                )}
                <div className="max-h-44 overflow-y-auto">
                  {workflows.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-muted-foreground">
                      No workflows yet - create one first.
                    </div>
                  ) : filteredWorkflows.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-muted-foreground">
                      No matches.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {filteredWorkflows.map((w) => {
                        const checked = selected.has(w.id);
                        return (
                          <li key={w.id}>
                            <label
                              className={cn(
                                "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                                checked
                                  ? "bg-muted/60"
                                  : "hover:bg-muted/40",
                              )}
                            >
                              <input
                                type="checkbox"
                                name="workflow_ids"
                                value={w.id}
                                checked={checked}
                                onChange={() => toggle(w.id)}
                                className="size-4 rounded border-zinc-300"
                              />
                              <span className="truncate">{w.name}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div className="border-t border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                  {selected.size} selected · at least 1 required
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-5">
              <div className="space-y-1">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  People affected
                </h3>
                <p className="text-xs text-muted-foreground">
                  Who has this intervention reached? Pick at least one person.
                  Drives per-person adoption tracking and reach metrics.
                </p>
              </div>
              <PeoplePicker
                people={people}
                selected={recipients}
                onChange={setRecipients}
                inputName="recipient_emails"
              />
            </div>

            <div className="space-y-3 border-t border-border pt-5">
              <div className="space-y-1">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Impact estimate
                </h3>
                <p className="text-xs text-muted-foreground">
                  Best guess per week. Refine later with snapshots. Enter 0 if a number doesn&apos;t apply.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="minutes_saved_per_week">
                    Minutes saved
                  </Label>
                  <SuffixInput suffix="/ wk">
                    <Input
                      id="minutes_saved_per_week"
                      name="minutes_saved_per_week"
                      type="number"
                      min={0}
                      step={1}
                      required
                      placeholder="0"
                    />
                  </SuffixInput>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="estimated_gbp_saved_per_week">
                    Cost saved
                  </Label>
                  <PrefixInput prefix="£">
                    <Input
                      id="estimated_gbp_saved_per_week"
                      name="estimated_gbp_saved_per_week"
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      placeholder="0"
                    />
                  </PrefixInput>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="estimated_revenue_per_week">
                    Revenue generated
                  </Label>
                  <PrefixInput prefix="£">
                    <Input
                      id="estimated_revenue_per_week"
                      name="estimated_revenue_per_week"
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      placeholder="0"
                    />
                  </PrefixInput>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="attribution_confidence">
                  Attribution confidence
                </Label>
                <input
                  type="hidden"
                  name="attribution_confidence"
                  value={confidence}
                />
                <Select
                  value={confidence}
                  onValueChange={(v) => setConfidence(v ?? "high")}
                >
                  <SelectTrigger id="attribution_confidence" className="w-full">
                    <SelectValue>
                      {(v) =>
                        CONFIDENCE_LABEL[v as string] ?? CONFIDENCE_LABEL.high
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">{CONFIDENCE_LABEL.high}</SelectItem>
                    <SelectItem value="medium">
                      {CONFIDENCE_LABEL.medium}
                    </SelectItem>
                    <SelectItem value="low">{CONFIDENCE_LABEL.low}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Weighted on the dashboard: high x1.0, medium x0.7, low x0.4.
                </p>
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-5">
              <div className="space-y-1">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Adoption & sentiment
                </h3>
                <p className="text-xs text-muted-foreground">
                  Snapshot it now. Both drift over time, so log a fresh snapshot
                  when they do.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="adoption_status">Is it being used?</Label>
                  <input
                    type="hidden"
                    name="adoption_status"
                    value={adoption}
                    required
                  />
                  <Select
                    value={adoption}
                    onValueChange={(v) => setAdoption(v ?? "")}
                  >
                    <SelectTrigger id="adoption_status" className="w-full">
                      <SelectValue placeholder="Pick one">
                        {(v) => (v ? ADOPTION_LABEL[v as string] ?? "" : null)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{ADOPTION_LABEL.daily}</SelectItem>
                      <SelectItem value="weekly">
                        {ADOPTION_LABEL.weekly}
                      </SelectItem>
                      <SelectItem value="occasional">
                        {ADOPTION_LABEL.occasional}
                      </SelectItem>
                      <SelectItem value="abandoned">
                        {ADOPTION_LABEL.abandoned}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="satisfaction">Do people like it?</Label>
                  <input
                    type="hidden"
                    name="satisfaction"
                    value={satisfaction}
                    required
                  />
                  <Select
                    value={satisfaction}
                    onValueChange={(v) => setSatisfaction(v ?? "")}
                  >
                    <SelectTrigger id="satisfaction" className="w-full">
                      <SelectValue placeholder="Pick one">
                        {(v) =>
                          v ? SATISFACTION_LABEL[v as string] ?? "" : null
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">{SATISFACTION_LABEL["1"]}</SelectItem>
                      <SelectItem value="2">{SATISFACTION_LABEL["2"]}</SelectItem>
                      <SelectItem value="3">{SATISFACTION_LABEL["3"]}</SelectItem>
                      <SelectItem value="4">{SATISFACTION_LABEL["4"]}</SelectItem>
                      <SelectItem value="5">{SATISFACTION_LABEL["5"]}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <SubmitButton disabled={!isComplete} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending}>
      {pending ? "Logging…" : "Log intervention"}
    </Button>
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
