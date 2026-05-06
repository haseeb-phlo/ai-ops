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
type Confidence = "high" | "medium" | "low";
type AdoptionStatus = "daily" | "weekly" | "occasional" | "abandoned";

export function EditInterventionDialog({
  intervention,
}: {
  intervention: {
    id: string;
    name: string;
    type: InterventionType | null;
    description: string | null;
    minutes_saved_per_week: number | null;
    attribution_confidence: Confidence | null;
    adoption_status: AdoptionStatus | null;
    satisfaction: number | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [type, setType] = useState<string>(intervention.type ?? "");
  const [confidence, setConfidence] = useState<string>(
    intervention.attribution_confidence ?? "medium",
  );
  const [adoption, setAdoption] = useState<string>(
    intervention.adoption_status ?? "",
  );
  const [satisfaction, setSatisfaction] = useState<string>(
    intervention.satisfaction != null ? String(intervention.satisfaction) : "",
  );

  const reset = () => {
    setType(intervention.type ?? "");
    setConfidence(intervention.attribution_confidence ?? "medium");
    setAdoption(intervention.adoption_status ?? "");
    setSatisfaction(
      intervention.satisfaction != null ? String(intervention.satisfaction) : "",
    );
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit intervention</DialogTitle>
            <DialogDescription>
              Every change is recorded in the audit trail below. Linked workflows
              and baselines aren&apos;t editable - re-log if those need changing.
            </DialogDescription>
          </DialogHeader>

          <form action={handleSubmit} className="space-y-4">
            <input type="hidden" name="id" value={intervention.id} />

            <div className="space-y-1.5">
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
                  <SelectValue placeholder="Pick one…">
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                maxLength={500}
                defaultValue={intervention.description ?? ""}
                placeholder="One-line summary (optional)"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="minutes_saved_per_week">
                Estimated minutes saved per week
              </Label>
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
                placeholder="Optional"
              />
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
                onValueChange={(v) => setConfidence(v ?? "medium")}
              >
                <SelectTrigger id="attribution_confidence" className="w-full">
                  <SelectValue>
                    {(v) =>
                      CONFIDENCE_LABEL[v as string] ?? CONFIDENCE_LABEL.medium
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                    <SelectValue placeholder="Optional">
                      {(v) => (v ? ADOPTION_LABEL[v as string] ?? "" : null)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">
                      {ADOPTION_LABEL.daily}
                    </SelectItem>
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
                    <SelectValue placeholder="Optional">
                      {(v) =>
                        v ? SATISFACTION_LABEL[v as string] ?? "" : null
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">
                      {SATISFACTION_LABEL["1"]}
                    </SelectItem>
                    <SelectItem value="2">
                      {SATISFACTION_LABEL["2"]}
                    </SelectItem>
                    <SelectItem value="3">
                      {SATISFACTION_LABEL["3"]}
                    </SelectItem>
                    <SelectItem value="4">
                      {SATISFACTION_LABEL["4"]}
                    </SelectItem>
                    <SelectItem value="5">
                      {SATISFACTION_LABEL["5"]}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {errorMessage && (
              <p
                role="alert"
                className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-inset ring-red-200"
              >
                {errorMessage}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || type === ""}>
                {isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
