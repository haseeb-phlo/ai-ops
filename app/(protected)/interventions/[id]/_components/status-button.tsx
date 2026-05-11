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
import { setInterventionStatus } from "../actions";

type Status = "active" | "paused" | "retired";

const COPY: Record<
  Status,
  {
    button: string;
    title: string;
    body: string;
    confirm: string;
    nextStatus: Status;
  }
> = {
  active: {
    button: "Retire",
    title: "Retire this AI initiative?",
    body: "It stops counting toward live dashboard totals, but stays on the record so historical comparisons remain honest. You can reactivate it later.",
    confirm: "Retire",
    nextStatus: "retired",
  },
  paused: {
    button: "Retire",
    title: "Retire this AI initiative?",
    body: "It stops counting toward live dashboard totals, but stays on the record. You can reactivate it later.",
    confirm: "Retire",
    nextStatus: "retired",
  },
  retired: {
    button: "Reactivate",
    title: "Reactivate this AI initiative?",
    body: "It will count toward live dashboard totals again from now on. Past snapshots are unchanged.",
    confirm: "Reactivate",
    nextStatus: "active",
  },
};

export function StatusButton({
  interventionId,
  status,
}: {
  interventionId: string;
  status: Status;
}) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const copy = COPY[status];

  const handleConfirm = () => {
    const formData = new FormData();
    formData.set("id", interventionId);
    formData.set("status", copy.nextStatus);
    startTransition(async () => {
      const result = await setInterventionStatus({ kind: "idle" }, formData);
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

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {copy.button}
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.body}</DialogDescription>
          </DialogHeader>

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
            <Button onClick={handleConfirm} disabled={isPending}>
              {isPending ? "Working…" : copy.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
