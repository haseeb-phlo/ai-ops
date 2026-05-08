"use client";

import { useState, useTransition } from "react";
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
import { updateIntervention } from "../actions";

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

type InterventionType = (typeof TYPES)[number]["value"];
type Status = "active" | "paused" | "retired";
type Confidence = "high" | "medium" | "low";
type AdoptionStatus = "daily" | "weekly" | "occasional" | "abandoned";

export function EditInterventionDialog({
  intervention,
  people,
}: {
  intervention: {
    id: string;
    name: string;
    type: InterventionType | null;
    status: Status | null;
    description: string | null;
    minutes_saved_per_week: number | null;
    estimated_gbp_saved_per_week: number | null;
    estimated_revenue_per_week: number | null;
    attribution_confidence: Confidence | null;
    adoption_status: AdoptionStatus | null;
    satisfaction: number | null;
    recipient_emails: string[];
  };
  people: PickerPerson[];
}) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [type, setType] = useState<string>(intervention.type ?? "");
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

  const reset = () => {
    setType(intervention.type ?? "");
    setStatus(intervention.status ?? "active");
    setConfidence(intervention.attribution_confidence ?? "medium");
    setAdoption(intervention.adoption_status ?? "");
    setSatisfaction(
      intervention.satisfaction != null ? String(intervention.satisfaction) : "",
    );
    setRecipients(new Set(intervention.recipient_emails ?? []));
    setErrorMessage(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    setOpen(next);
  };

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

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="gap-2 px-6 pt-5 pb-5">
            <DialogTitle>Edit intervention</DialogTitle>
            <DialogDescription>
              Every change is recorded in the audit trail below. Linked
              workflows and baselines aren&apos;t editable - re-log if those
              need changing.
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

                <div className="space-y-1.5">
                  <Label htmlFor="type">Type</Label>
                  <input type="hidden" name="type" value={type} />
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

              {/* Order matches the Log Intervention dialog: identity →
                  people affected → impact estimate → adoption. Affected
                  workflows aren't shown here because they're immutable
                  post-creation. */}
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
                    Impact estimate
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Best guess per week. Snapshots refine over time.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="minutes_saved_per_week">Minutes saved</Label>
                    <SuffixInput suffix="/ wk">
                      <Input
                        id="minutes_saved_per_week"
                        name="minutes_saved_per_week"
                        type="number"
                        min={0}
                        step={1}
                        defaultValue={
                          intervention.minutes_saved_per_week != null
                            ? String(intervention.minutes_saved_per_week)
                            : ""
                        }
                        placeholder="0"
                      />
                    </SuffixInput>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="estimated_gbp_saved_per_week">Cost saved</Label>
                    <PrefixInput prefix="£">
                      <SuffixInput suffix="/ wk">
                        <Input
                          id="estimated_gbp_saved_per_week"
                          name="estimated_gbp_saved_per_week"
                          type="number"
                          min={0}
                          step="0.01"
                          defaultValue={
                            intervention.estimated_gbp_saved_per_week != null
                              ? String(
                                  intervention.estimated_gbp_saved_per_week,
                                )
                              : ""
                          }
                          placeholder="0"
                        />
                      </SuffixInput>
                    </PrefixInput>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="estimated_revenue_per_week">Revenue generated</Label>
                    <PrefixInput prefix="£">
                      <SuffixInput suffix="/ wk">
                        <Input
                          id="estimated_revenue_per_week"
                          name="estimated_revenue_per_week"
                          type="number"
                          min={0}
                          step="0.01"
                          defaultValue={
                            intervention.estimated_revenue_per_week != null
                              ? String(intervention.estimated_revenue_per_week)
                              : ""
                          }
                          placeholder="0"
                        />
                      </SuffixInput>
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
              <Button type="submit" disabled={isPending || type === ""}>
                {isPending ? "Saving" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
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
