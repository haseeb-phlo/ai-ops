"use client";

import { useMemo, useState, useTransition } from "react";
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
import {
  CADENCES,
  CADENCE_LABEL,
  cadenceToPerWeek,
  formatCadence,
  isCadence,
  perWeekToCadence,
  type Cadence,
} from "@/lib/frequency";
import { updateIntervention } from "../actions";

const TYPES = [
  { value: "tool", label: "Tool" },
  { value: "training", label: "Training" },
  { value: "prompt", label: "Prompt" },
  { value: "agent", label: "Agent" },
  { value: "automation", label: "Automation" },
  { value: "process_change", label: "Process change" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  retired: "Retired",
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "High - clean before/after",
  medium: "Medium - confounded by other changes",
  low: "Low - best-guess; many things moved at once",
};

const ADOPTION_LABEL: Record<string, string> = {
  daily: "Daily - used every day",
  weekly: "Weekly - a few times a week",
  occasional: "Occasional - now and then",
  abandoned: "Not in use",
};

const SATISFACTION_LABEL: Record<string, string> = {
  "1": "1 - Very dissatisfied",
  "2": "2 - Dissatisfied",
  "3": "3 - Neutral",
  "4": "4 - Satisfied",
  "5": "5 - Very satisfied",
};

type InterventionType = (typeof TYPES)[number]["value"];
type Status = "active" | "paused" | "retired";
type Confidence = "high" | "medium" | "low";
type AdoptionStatus = "daily" | "weekly" | "occasional" | "abandoned";

export type LinkedWorkflowContext = {
  id: string;
  name: string;
  frequency_per_week: number | null;
  frequency_cadence: string | null;
  hours_per_week: number | null;
  cost_per_week: number | null;
  revenue_per_week: number | null;
};

export function EditInterventionDialog({
  intervention,
  people,
  linkedWorkflows = [],
}: {
  intervention: {
    id: string;
    name: string;
    types: InterventionType[];
    status: Status | null;
    description: string | null;
    uses_per_week: number | null;
    frequency_cadence: string | null;
    minutes_saved_per_use: number | null;
    cost_saved_per_use: number | null;
    revenue_per_use: number | null;
    attribution_confidence: Confidence | null;
    adoption_status: AdoptionStatus | null;
    satisfaction: number | null;
    recipient_emails: string[];
    notes: string | null;
  };
  people: PickerPerson[];
  linkedWorkflows?: LinkedWorkflowContext[];
}) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [types, setTypes] = useState<Set<string>>(
    new Set(intervention.types ?? []),
  );
  const [status, setStatus] = useState<string>(intervention.status ?? "active");
  const [confidence, setConfidence] = useState<string>(
    intervention.attribution_confidence ?? "medium",
  );
  const [adoption, setAdoption] = useState<string>(
    intervention.adoption_status ?? "",
  );
  const [satisfaction, setSatisfaction] = useState<string>(
    intervention.satisfaction != null ? String(intervention.satisfaction) : "",
  );
  const [recipients, setRecipients] = useState<Set<string>>(
    new Set(intervention.recipient_emails ?? []),
  );

  // Cadence preference at open time: stored cadence → bucketed numeric →
  // "weekly" default. Means pre-migration rows still get a sensible
  // starting value when the dialog opens.
  const initialCadence: Cadence =
    (isCadence(intervention.frequency_cadence)
      ? intervention.frequency_cadence
      : perWeekToCadence(intervention.uses_per_week)) ?? "weekly";

  const [cadence, setCadence] = useState<Cadence>(initialCadence);
  const [minutesPerUse, setMinutesPerUse] = useState<string>(
    intervention.minutes_saved_per_use != null
      ? String(intervention.minutes_saved_per_use)
      : "",
  );
  const [costPerUse, setCostPerUse] = useState<string>(
    intervention.cost_saved_per_use != null
      ? String(intervention.cost_saved_per_use)
      : "",
  );
  const [revenuePerUse, setRevenuePerUse] = useState<string>(
    intervention.revenue_per_use != null
      ? String(intervention.revenue_per_use)
      : "",
  );

  const reset = () => {
    setTypes(new Set(intervention.types ?? []));
    setStatus(intervention.status ?? "active");
    setConfidence(intervention.attribution_confidence ?? "medium");
    setAdoption(intervention.adoption_status ?? "");
    setSatisfaction(
      intervention.satisfaction != null ? String(intervention.satisfaction) : "",
    );
    setRecipients(new Set(intervention.recipient_emails ?? []));
    setCadence(initialCadence);
    setMinutesPerUse(
      intervention.minutes_saved_per_use != null
        ? String(intervention.minutes_saved_per_use)
        : "",
    );
    setCostPerUse(
      intervention.cost_saved_per_use != null
        ? String(intervention.cost_saved_per_use)
        : "",
    );
    setRevenuePerUse(
      intervention.revenue_per_use != null
        ? String(intervention.revenue_per_use)
        : "",
    );
    setErrorMessage(null);
  };

  const toggleType = (value: string) => {
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    setOpen(next);
  };

  // Only show per-run baseline context when there's exactly one linked
  // workflow with a usable frequency. Linked workflows are immutable
  // post-creation so this never changes mid-edit.
  const singleLinkedWorkflow = useMemo<LinkedWorkflowContext | null>(() => {
    return linkedWorkflows.length === 1 ? linkedWorkflows[0] : null;
  }, [linkedWorkflows]);

  const perRunBaseline = useMemo(() => {
    if (!singleLinkedWorkflow) return null;
    const freq = singleLinkedWorkflow.frequency_per_week;
    if (freq == null || freq <= 0) return null;
    const hours = singleLinkedWorkflow.hours_per_week ?? 0;
    const cost = singleLinkedWorkflow.cost_per_week ?? 0;
    const revenue = singleLinkedWorkflow.revenue_per_week ?? 0;
    return {
      minutes: (hours * 60) / freq,
      cost: cost / freq,
      revenue: revenue / freq,
    };
  }, [singleLinkedWorkflow]);

  const uses = cadenceToPerWeek(cadence);
  const weeklyMinutes = uses * (toNum(minutesPerUse) ?? 0);
  const weeklyCost = uses * (toNum(costPerUse) ?? 0);
  const weeklyRevenue = uses * (toNum(revenuePerUse) ?? 0);

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await updateIntervention({ kind: "idle" }, formData);
      if (result.kind === "error") {
        setErrorMessage(result.message);
      } else if (result.kind === "success") {
        setErrorMessage(null);
        setOpen(false);
      }
    });
  };

  const isComplete =
    types.size > 0 &&
    toNum(minutesPerUse) != null &&
    toNum(costPerUse) != null &&
    toNum(revenuePerUse) != null;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="gap-2 px-6 pt-5 pb-5">
            <DialogTitle>Edit AI initiative</DialogTitle>
            <DialogDescription>
              Linked workflows and baselines are fixed at log time. Re-log to
              change them.
            </DialogDescription>
          </DialogHeader>

          <form action={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-6 overflow-y-auto border-t border-border px-6 py-5">
              <input type="hidden" name="id" value={intervention.id} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    maxLength={200}
                    defaultValue={intervention.name}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Type</Label>
                  <p className="text-xs text-muted-foreground">
                    Pick one or more.
                  </p>
                  <div
                    role="group"
                    aria-label="Initiative type"
                    className="flex flex-wrap gap-1.5"
                  >
                    {TYPES.map((t) => {
                      const checked = types.has(t.value);
                      return (
                        <label
                          key={t.value}
                          className={cn(
                            "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring/50",
                            checked
                              ? "border-foreground bg-foreground text-background"
                              : "border-border bg-background text-foreground hover:bg-muted",
                          )}
                        >
                          <input
                            type="checkbox"
                            name="types"
                            value={t.value}
                            checked={checked}
                            onChange={() => toggleType(t.value)}
                            className="sr-only"
                          />
                          {t.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="status">Status</Label>
                  <input type="hidden" name="status" value={status} />
                  <Select
                    value={status}
                    onValueChange={(v) => setStatus(v ?? "active")}
                  >
                    <SelectTrigger id="status" className="w-full">
                      <SelectValue>
                        {(v) =>
                          STATUS_LABEL[v as string] ?? STATUS_LABEL.active
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    rows={2}
                    maxLength={500}
                    defaultValue={intervention.description ?? ""}
                    placeholder="One-line summary"
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-border pt-5">
                <div className="space-y-1">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    People affected
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Drives per-person reach metrics. Add or remove anyone
                    whose access has changed.
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
                    Impact per run × times per week
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    What does one run save, and how often does it run? The
                    weekly total is computed below.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="frequency_cadence">
                    How often does this AI initiative run?
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
                        {(v) =>
                          v ? CADENCE_LABEL[v as Cadence] ?? "" : null
                        }
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
                  {singleLinkedWorkflow &&
                    formatCadence(
                      singleLinkedWorkflow.frequency_cadence,
                      singleLinkedWorkflow.frequency_per_week,
                    ) && (
                      <p className="text-xs text-muted-foreground">
                        Linked workflow{" "}
                        <span className="font-medium text-foreground">
                          {singleLinkedWorkflow.name}
                        </span>{" "}
                        runs{" "}
                        {formatCadence(
                          singleLinkedWorkflow.frequency_cadence,
                          singleLinkedWorkflow.frequency_per_week,
                        )}
                        .
                      </p>
                    )}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="minutes_saved_per_use">
                      Minutes saved each run
                    </Label>
                    <SuffixInput suffix="/ run">
                      <Input
                        id="minutes_saved_per_use"
                        name="minutes_saved_per_use"
                        type="number"
                        min={0}
                        step={1}
                        required
                        value={minutesPerUse}
                        onChange={(e) => setMinutesPerUse(e.target.value)}
                        placeholder="0"
                      />
                    </SuffixInput>
                    <WeeklyReadout
                      perUse={toNum(minutesPerUse)}
                      uses={uses}
                      suffix="min / wk"
                    />
                    {perRunBaseline && (
                      <p className="text-[11px] text-muted-foreground">
                        Workflow baseline:{" "}
                        <span className="text-foreground tabular-nums">
                          ~{formatNumber(perRunBaseline.minutes)} min
                        </span>{" "}
                        per run.
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cost_saved_per_use">
                      Cost saved each run
                    </Label>
                    <PrefixInput prefix="£">
                      <SuffixInput suffix="/ run">
                        <Input
                          id="cost_saved_per_use"
                          name="cost_saved_per_use"
                          type="number"
                          min={0}
                          step="0.01"
                          required
                          value={costPerUse}
                          onChange={(e) => setCostPerUse(e.target.value)}
                          placeholder="0"
                        />
                      </SuffixInput>
                    </PrefixInput>
                    <WeeklyReadout
                      perUse={toNum(costPerUse)}
                      uses={uses}
                      suffix="/ wk"
                      isCurrency
                    />
                    {perRunBaseline && (
                      <p className="text-[11px] text-muted-foreground">
                        Workflow baseline:{" "}
                        <span className="text-foreground tabular-nums">
                          ~£{formatNumber(perRunBaseline.cost)}
                        </span>{" "}
                        per run.
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="revenue_per_use">Revenue each run</Label>
                    <PrefixInput prefix="£">
                      <SuffixInput suffix="/ run">
                        <Input
                          id="revenue_per_use"
                          name="revenue_per_use"
                          type="number"
                          min={0}
                          step="0.01"
                          required
                          value={revenuePerUse}
                          onChange={(e) => setRevenuePerUse(e.target.value)}
                          placeholder="0"
                        />
                      </SuffixInput>
                    </PrefixInput>
                    <WeeklyReadout
                      perUse={toNum(revenuePerUse)}
                      uses={uses}
                      suffix="/ wk"
                      isCurrency
                    />
                    {perRunBaseline && (
                      <p className="text-[11px] text-muted-foreground">
                        Workflow baseline:{" "}
                        <span className="text-foreground tabular-nums">
                          ~£{formatNumber(perRunBaseline.revenue)}
                        </span>{" "}
                        per run.
                      </p>
                    )}
                  </div>
                </div>

                {weeklyMinutes != null &&
                  weeklyCost != null &&
                  weeklyRevenue != null &&
                  uses != null &&
                  uses > 0 &&
                  (weeklyMinutes > 0 ||
                    weeklyCost > 0 ||
                    weeklyRevenue > 0) && (
                    <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      Weekly total ={" "}
                      <span className="text-foreground tabular-nums">
                        {formatNumber(weeklyMinutes)} min
                      </span>
                      {", "}
                      <span className="text-foreground tabular-nums">
                        £{formatNumber(weeklyCost)}
                      </span>
                      {" saved"}
                      {weeklyRevenue > 0 && (
                        <>
                          {", "}
                          <span className="text-foreground tabular-nums">
                            £{formatNumber(weeklyRevenue)}
                          </span>{" "}
                          revenue
                        </>
                      )}
                      .
                    </div>
                  )}

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
                    <SelectTrigger
                      id="attribution_confidence"
                      className="w-full"
                    >
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
                    Editorial signal for reviewers. Doesn&apos;t change the
                    dashboard math.
                  </p>
                </div>
              </div>

              <div className="space-y-3 border-t border-border pt-5">
                <div className="space-y-1">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Adoption & sentiment
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Optional - updated as people start using it.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="adoption_status">Is it being used?</Label>
                    <input
                      type="hidden"
                      name="adoption_status"
                      value={adoption}
                    />
                    <Select
                      value={adoption}
                      onValueChange={(v) => setAdoption(v ?? "")}
                    >
                      <SelectTrigger id="adoption_status" className="w-full">
                        <SelectValue placeholder="Pick one">
                          {(v) =>
                            v ? ADOPTION_LABEL[v as string] ?? "" : null
                          }
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

              <div className="space-y-3 border-t border-border pt-5">
                <div className="space-y-1">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Notes
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Optional. Context, caveats, links. Plain text, line breaks
                    preserved. Tracked in the audit log.
                  </p>
                </div>
                <Textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  maxLength={2000}
                  defaultValue={intervention.notes ?? ""}
                  placeholder="Anything reviewers should know about this initiative."
                />
              </div>

              {errorMessage && (
                <p
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {errorMessage}
                </p>
              )}
            </div>

            <DialogFooter className="m-0 border-t border-border bg-muted/40 px-6 py-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !isComplete}>
                {isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function WeeklyReadout({
  perUse,
  uses,
  suffix,
  isCurrency = false,
}: {
  perUse: number | null;
  uses: number | null;
  suffix: string;
  isCurrency?: boolean;
}) {
  if (perUse == null || uses == null) {
    return (
      <p className="text-[11px] text-muted-foreground">
        = enter both values to see weekly total
      </p>
    );
  }
  const weekly = perUse * uses;
  const display = isCurrency
    ? `£${formatNumber(weekly)}`
    : formatNumber(weekly);
  return (
    <p className="text-[11px] text-muted-foreground">
      ={" "}
      <span className="font-medium text-foreground tabular-nums">
        {display}
      </span>{" "}
      {suffix}
    </p>
  );
}

function toNum(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function formatNumber(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
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
