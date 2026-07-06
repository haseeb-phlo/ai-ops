"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { TagInput } from "@/components/ui/tag-input";
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
import { logIntervention, type LogInterventionState } from "../actions";

const TYPES = [
  { value: "tool", label: "Tool" },
  { value: "training", label: "Training" },
  { value: "prompt", label: "Prompt" },
  { value: "agent", label: "Agent" },
  { value: "automation", label: "Automation" },
  { value: "process_change", label: "Process change" },
] as const;

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "High - clean before/after, isolated change",
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

export type WorkflowForLog = {
  id: string;
  name: string;
  frequency_per_week: number | null;
  frequency_cadence: string | null;
  hours_per_week: number | null;
  cost_per_week: number | null;
  revenue_per_week: number | null;
};

export function LogInterventionDialog({
  workflows,
  people,
  toolSuggestions = [],
}: {
  workflows: WorkflowForLog[];
  people: PickerPerson[];
  toolSuggestions?: string[];
}) {
  const [open, setOpen] = useState(false);
  // Remount the inner form on each open: fresh useActionState + fields, so
  // stale errors / drafts from a previous session never reappear.
  const [epoch, setEpoch] = useState(0);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirtyRef = useRef(false);
  const pendingRef = useRef(false);

  function handleOpenChange(next: boolean) {
    if (pendingRef.current) return;
    if (!next && dirtyRef.current) {
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
        <DialogTrigger render={<Button>Log initiative</Button>} />
        <DialogContent className="gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="gap-2 px-6 pt-5 pb-5">
            <DialogTitle>Log new AI initiative</DialogTitle>
            <DialogDescription>
              A tool, prompt, training session, or process change you&apos;ve
              shipped. We snapshot each affected workflow&apos;s current
              numbers as the baseline. Fields marked * are required.
            </DialogDescription>
          </DialogHeader>

          <LogInterventionForm
            key={epoch}
            workflows={workflows}
            people={people}
            toolSuggestions={toolSuggestions}
            onDirty={() => {
              dirtyRef.current = true;
            }}
            onPendingChange={(p) => {
              pendingRef.current = p;
            }}
            onCancel={() => handleOpenChange(false)}
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

function LogInterventionForm({
  workflows,
  people,
  toolSuggestions,
  onDirty,
  onPendingChange,
  onCancel,
}: {
  workflows: WorkflowForLog[];
  people: PickerPerson[];
  toolSuggestions: string[];
  onDirty: () => void;
  onPendingChange: (pending: boolean) => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    LogInterventionState,
    FormData
  >(logIntervention, { kind: "idle" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [types, setTypes] = useState<Set<string>>(new Set());
  const [confidence, setConfidence] = useState<string>("high");
  const [adoption, setAdoption] = useState<string>("");
  const [satisfaction, setSatisfaction] = useState<string>("");
  const [recipients, setRecipients] = useState<Set<string>>(new Set());
  const [tools, setTools] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  // Atomic impact inputs. Storing as strings keeps "" (empty) distinct from
  // 0 so the live readout doesn't show "= 0 / wk" before the user has typed.
  // Cadence is empty until the user picks one (or it auto-fills from a
  // single linked workflow's cadence).
  const [cadence, setCadence] = useState<Cadence | "">("");
  const [minutesPerUse, setMinutesPerUse] = useState<string>("");
  const [costPerUse, setCostPerUse] = useState<string>("");
  const [revenuePerUse, setRevenuePerUse] = useState<string>("");
  // Which impact inputs the user has actually touched - the "enter both
  // values" readout hint only appears after interaction, so at rest it
  // doesn't read like an error.
  const [touched, setTouched] = useState({
    cadence: false,
    minutes: false,
    cost: false,
    revenue: false,
  });

  // React 19 auto-resets uncontrolled fields after the action settles, even
  // on a validation error. Snapshot the FormData on submit and immediately
  // remount the uncontrolled fields (name / description / notes) with the
  // snapshot as defaultValues; the auto-reset then restores those defaults,
  // so typed input survives an error round-trip.
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

  // Track the last workflow id we auto-filled the cadence from. If the
  // user picks a different single workflow we re-fill; if they pick a
  // different cadence manually we leave it alone on subsequent re-renders.
  const lastAutoFilledFromWorkflowId = useRef<string | null>(null);

  const toggleType = (value: string) => {
    onDirty();
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const toggle = (id: string) => {
    onDirty();
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

  // Find the single selected workflow (if exactly one is picked).
  const singleSelectedWorkflow = useMemo<WorkflowForLog | null>(() => {
    if (selected.size !== 1) return null;
    const [onlyId] = Array.from(selected);
    return workflows.find((w) => w.id === onlyId) ?? null;
  }, [selected, workflows]);

  // Auto-fill cadence from a single-selected workflow's cadence (or the
  // numeric value bucketed into the nearest cadence). Only when the
  // source workflow changes, and only if the user hasn't picked a
  // different cadence manually since the last auto-fill.
  const inferredCadence: Cadence | null = singleSelectedWorkflow
    ? isCadence(singleSelectedWorkflow.frequency_cadence)
      ? singleSelectedWorkflow.frequency_cadence
      : perWeekToCadence(singleSelectedWorkflow.frequency_per_week)
    : null;
  const inferredSourceId =
    singleSelectedWorkflow && inferredCadence
      ? singleSelectedWorkflow.id
      : null;
  useEffect(() => {
    if (
      inferredSourceId &&
      inferredCadence &&
      lastAutoFilledFromWorkflowId.current !== inferredSourceId
    ) {
      setCadence(inferredCadence);
      lastAutoFilledFromWorkflowId.current = inferredSourceId;
    } else if (!singleSelectedWorkflow) {
      lastAutoFilledFromWorkflowId.current = null;
    }
  }, [singleSelectedWorkflow, inferredSourceId, inferredCadence]);

  // Per-run baseline shown as context next to the per-use inputs. Only
  // computed when exactly one workflow is selected and has a frequency >
  // 0 - that's the only situation where dividing is honest.
  const perRunBaseline = useMemo(() => {
    if (!singleSelectedWorkflow) return null;
    const freq = singleSelectedWorkflow.frequency_per_week;
    if (freq == null || freq <= 0) return null;
    const hours = singleSelectedWorkflow.hours_per_week ?? 0;
    const cost = singleSelectedWorkflow.cost_per_week ?? 0;
    const revenue = singleSelectedWorkflow.revenue_per_week ?? 0;
    return {
      minutes: (hours * 60) / freq,
      cost: cost / freq,
      revenue: revenue / freq,
    };
  }, [singleSelectedWorkflow]);

  const uses = cadence === "" ? null : cadenceToPerWeek(cadence);
  const weeklyMinutes = uses != null ? uses * (toNum(minutesPerUse) ?? 0) : null;
  const weeklyCost = uses != null ? uses * (toNum(costPerUse) ?? 0) : null;
  const weeklyRevenue = uses != null ? uses * (toNum(revenuePerUse) ?? 0) : null;

  // Same conditions that disable the submit button, spelled out so the
  // user can see what's left instead of guessing at a dead button.
  const missing: string[] = [];
  if (types.size === 0) missing.push("choose a type");
  if (selected.size === 0) missing.push("link a workflow");
  if (recipients.size === 0) missing.push("pick who's affected");
  if (cadence === "") missing.push("pick a cadence");
  if (
    toNum(minutesPerUse) == null ||
    toNum(costPerUse) == null ||
    toNum(revenuePerUse) == null
  ) {
    missing.push("add the per-run numbers");
  }
  const isComplete = missing.length === 0;
  const hintId = "log-initiative-missing-hint";

  return (
    <form
      action={formAction}
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
              Name
              <RequiredMark />
            </Label>
            <Input
              key={`name-${submitEpoch}`}
              id="name"
              name="name"
              required
              maxLength={200}
              defaultValue={d("name")}
              placeholder="e.g. Stock-count co-pilot"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>
              Type
              <RequiredMark />
            </Label>
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

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="description">
              Description
              <RequiredMark />
            </Label>
            <Textarea
              key={`description-${submitEpoch}`}
              id="description"
              name="description"
              rows={2}
              required
              minLength={3}
              maxLength={500}
              defaultValue={d("description")}
              placeholder="One-line summary of what you shipped."
            />
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <div className="space-y-1">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Affected workflows
              <RequiredMark />
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
                            className="size-4 rounded border-input"
                          />
                          <span className="truncate">{w.name}</span>
                          {formatCadence(
                            w.frequency_cadence,
                            w.frequency_per_week,
                          ) && (
                            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                              {formatCadence(
                                w.frequency_cadence,
                                w.frequency_per_week,
                              )}
                            </span>
                          )}
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
              <RequiredMark />
            </h3>
            <p className="text-xs text-muted-foreground">
              Who has this AI initiative reached? Pick at least one person.
              Drives per-person adoption tracking and reach metrics.
            </p>
          </div>
          <PeoplePicker
            people={people}
            selected={recipients}
            onChange={(next) => {
              onDirty();
              setRecipients(next);
            }}
            inputName="recipient_emails"
          />
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <div className="space-y-1">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tools used
            </h3>
            <p className="text-xs text-muted-foreground">
              Apps, AI models, or systems this AI initiative runs on.
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
            placeholder="e.g. Claude, Zapier, n8n"
          />
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <div className="space-y-1">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Impact per run × times per week
              <RequiredMark />
            </h3>
            <p className="text-xs text-muted-foreground">
              Enter what one run saves, and how often the initiative runs.
              The per-week total is shown below each input. Enter 0 if a
              number doesn&apos;t apply.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="frequency_cadence">
              How often does this AI initiative run?
              <RequiredMark />
            </Label>
            <input
              type="hidden"
              name="frequency_cadence"
              value={cadence}
            />
            <Select
              value={cadence}
              onValueChange={(v) => {
                onDirty();
                setCadence((v ?? "") as Cadence | "");
                setTouched((t) => ({ ...t, cadence: true }));
                // User-picked values stick - clear the auto-fill memo
                // so re-selecting the same workflow won't overwrite.
                lastAutoFilledFromWorkflowId.current = null;
              }}
            >
              <SelectTrigger
                id="frequency_cadence"
                className="w-full"
                aria-required="true"
              >
                <SelectValue placeholder="Pick a cadence">
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
            {singleSelectedWorkflow &&
              formatCadence(
                singleSelectedWorkflow.frequency_cadence,
                singleSelectedWorkflow.frequency_per_week,
              ) && (
                <p className="text-xs text-muted-foreground">
                  Defaulted from{" "}
                  <span className="font-medium text-foreground">
                    {singleSelectedWorkflow.name}
                  </span>{" "}
                  (
                  {formatCadence(
                    singleSelectedWorkflow.frequency_cadence,
                    singleSelectedWorkflow.frequency_per_week,
                  )}
                  ). Change if this AI initiative runs on a different
                  cadence.
                </p>
              )}
            {selected.size > 1 && (
              <p className="text-xs text-muted-foreground">
                Multiple workflows linked - pick how often this AI
                initiative itself runs.
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
                  onChange={(e) => {
                    setMinutesPerUse(e.target.value);
                    setTouched((t) => ({ ...t, minutes: true }));
                  }}
                />
              </SuffixInput>
              <WeeklyReadout
                perUse={toNum(minutesPerUse)}
                uses={uses}
                suffix="min / wk"
                interacted={touched.minutes || touched.cadence}
              />
              {perRunBaseline && (
                <p className="text-xs text-muted-foreground">
                  Today this workflow takes{" "}
                  <span className="text-foreground tabular-nums">
                    ~{formatNumber(perRunBaseline.minutes)} min
                  </span>{" "}
                  per run.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cost_saved_per_use">Cost saved each run</Label>
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
                    onChange={(e) => {
                      setCostPerUse(e.target.value);
                      setTouched((t) => ({ ...t, cost: true }));
                    }}
                  />
                </SuffixInput>
              </PrefixInput>
              <WeeklyReadout
                perUse={toNum(costPerUse)}
                uses={uses}
                suffix="/ wk"
                isCurrency
                interacted={touched.cost || touched.cadence}
              />
              {perRunBaseline && (
                <p className="text-xs text-muted-foreground">
                  Today this workflow costs{" "}
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
                    onChange={(e) => {
                      setRevenuePerUse(e.target.value);
                      setTouched((t) => ({ ...t, revenue: true }));
                    }}
                  />
                </SuffixInput>
              </PrefixInput>
              <WeeklyReadout
                perUse={toNum(revenuePerUse)}
                uses={uses}
                suffix="/ wk"
                isCurrency
                interacted={touched.revenue || touched.cadence}
              />
              {perRunBaseline && (
                <p className="text-xs text-muted-foreground">
                  Today this workflow generates{" "}
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
            (weeklyMinutes > 0 || weeklyCost > 0 || weeklyRevenue > 0) && (
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
              onValueChange={(v) => {
                onDirty();
                setConfidence(v ?? "high");
              }}
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
              Editorial signal for reviewers - flags uncertain estimates.
              Doesn&apos;t change the dashboard math.
            </p>
          </div>
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
            key={`notes-${submitEpoch}`}
            id="notes"
            name="notes"
            rows={4}
            maxLength={2000}
            defaultValue={d("notes")}
            placeholder="e.g. Tool only works for the Stockholm warehouse for now; Berlin pilot starts next month."
          />
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <div className="space-y-1">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Adoption & sentiment
            </h3>
            <p className="text-xs text-muted-foreground">
              Optional - skip if you&apos;re logging the day you ship.
              Fill in on the first snapshot once people have used it.
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
                onValueChange={(v) => {
                  onDirty();
                  setAdoption(v ?? "");
                }}
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
              />
              <Select
                value={satisfaction}
                onValueChange={(v) => {
                  onDirty();
                  setSatisfaction(v ?? "");
                }}
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
          <Alert variant="destructive" ref={errorRef} tabIndex={-1}>
            {state.message}
          </Alert>
        )}
      </div>

      <DialogFooter className="m-0 border-t border-border bg-muted/40 px-6 py-3">
        {!isComplete && (
          <p
            id={hintId}
            className="self-center text-xs text-muted-foreground sm:mr-auto"
          >
            To save: {missing.join(", ")}.
          </p>
        )}
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!isComplete || pending}
          aria-describedby={!isComplete ? hintId : undefined}
        >
          {pending ? "Logging…" : "Log initiative"}
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

function WeeklyReadout({
  perUse,
  uses,
  suffix,
  isCurrency = false,
  interacted = true,
}: {
  perUse: number | null;
  uses: number | null;
  suffix: string;
  isCurrency?: boolean;
  /** The "enter both values" nudge only shows after the user has touched
   *  the per-use input or the cadence - at rest it read like an error. */
  interacted?: boolean;
}) {
  if (perUse == null || uses == null) {
    if (!interacted) return null;
    return (
      <p className="text-xs text-muted-foreground">
        = enter both values to see weekly total
      </p>
    );
  }
  const weekly = perUse * uses;
  const display = isCurrency
    ? `£${formatNumber(weekly)}`
    : formatNumber(weekly);
  return (
    <p className="text-xs text-muted-foreground">
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
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
        {suffix}
      </span>
    </div>
  );
}
