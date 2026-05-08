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
import { logMetricSnapshot } from "../actions";

export function LogMetricSnapshotButton({
  interventionId,
}: {
  interventionId: string;
}) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await logMetricSnapshot({ kind: "idle" }, formData);
      if (result.kind === "error") {
        setErrorMessage(result.message);
      } else if (result.kind === "success") {
        setErrorMessage(null);
        setOpen(false);
      }
    });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setErrorMessage(null);
    setOpen(next);
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Log metric snapshot</Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Log metric snapshot</DialogTitle>
            <DialogDescription>
              Record where the linked workflows are today. Leave fields blank if
              you haven&apos;t measured them.
            </DialogDescription>
          </DialogHeader>

          <form action={handleSubmit} className="space-y-4">
            <input type="hidden" name="intervention_id" value={interventionId} />

            <div className="space-y-1.5">
              <Label htmlFor="snapshot_date">Date</Label>
              <Input
                id="snapshot_date"
                name="snapshot_date"
                type="date"
                defaultValue={today}
                required
              />
            </div>

            <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
              Enter today&apos;s value for each metric. Savings are computed
              automatically against the baseline captured when this
              intervention was logged - don&apos;t enter the savings amount
              yourself.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NumField
                label="Time per week (min)"
                name="time_value"
                hint="Lower than baseline = time saved"
              />
              <NumField
                label="Cost per week (£)"
                name="cost_value"
                hint="Lower than baseline = cost saved"
              />
              <NumField label="People involved" name="people_value" />
              <NumField label="Errors per week" name="errors_value" />
              <NumField
                label="Revenue per week (£)"
                name="revenue_value"
                hint="Higher than baseline = revenue uplift"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={2}
                maxLength={500}
                placeholder="Optional"
              />
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
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save snapshot"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NumField({
  label,
  name,
  hint,
}: {
  label: string;
  name: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" step="any" placeholder="-" />
      {hint && <p className="text-[11px] text-zinc-500">{hint}</p>}
    </div>
  );
}
