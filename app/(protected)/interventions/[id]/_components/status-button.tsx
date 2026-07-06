"use client";

import { useState, useTransition } from "react";
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
import { setInterventionStatus } from "../actions";

type Status = "active" | "paused" | "retired";

type Transition = {
  label: string;
  next: Status;
  title: string;
  body: string;
  confirm: string;
  pending: string;
};

/**
 * The single status-change path (the edit dialog deliberately has no status
 * field). Each current status offers its allowed transitions, each behind
 * its own confirm dialog whose copy names the current status and the
 * dashboard consequence.
 */
const TRANSITIONS: Record<Status, Transition[]> = {
  active: [
    {
      label: "Pause",
      next: "paused",
      title: "Pause this AI initiative?",
      body: "It's currently active. While paused it stops counting toward live dashboard totals, but stays on the record. You can reactivate it any time.",
      confirm: "Pause",
      pending: "Pausing…",
    },
    {
      label: "Retire",
      next: "retired",
      title: "Retire this AI initiative?",
      body: "It's currently active. Once retired it stops counting toward live dashboard totals, but stays on the record. You can reactivate it later.",
      confirm: "Retire",
      pending: "Retiring…",
    },
  ],
  paused: [
    {
      label: "Reactivate",
      next: "active",
      title: "Reactivate this AI initiative?",
      body: "It's currently paused. It will count toward live dashboard totals again from now on. Past snapshots are unchanged.",
      confirm: "Reactivate",
      pending: "Reactivating…",
    },
    {
      label: "Retire",
      next: "retired",
      title: "Retire this AI initiative?",
      body: "It's currently paused, so it already doesn't count toward dashboard totals. Retiring marks it as finished for good - you can still reactivate later if that changes.",
      confirm: "Retire",
      pending: "Retiring…",
    },
  ],
  retired: [
    {
      label: "Reactivate",
      next: "active",
      title: "Reactivate this AI initiative?",
      body: "It's currently retired. It will count toward live dashboard totals again from now on. Past snapshots are unchanged.",
      confirm: "Reactivate",
      pending: "Reactivating…",
    },
  ],
};

export function StatusButton({
  interventionId,
  status,
}: {
  interventionId: string;
  status: Status;
}) {
  return (
    <>
      {TRANSITIONS[status].map((t) => (
        <StatusTransitionButton
          key={t.next}
          interventionId={interventionId}
          transition={t}
        />
      ))}
    </>
  );
}

function StatusTransitionButton({
  interventionId,
  transition,
}: {
  interventionId: string;
  transition: Transition;
}) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpenChange = (next: boolean) => {
    if (isPending) return;
    if (!next) setErrorMessage(null);
    setOpen(next);
  };

  const handleConfirm = () => {
    const formData = new FormData();
    formData.set("id", interventionId);
    formData.set("status", transition.next);
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button variant="outline">{transition.label}</Button>}
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{transition.title}</DialogTitle>
          <DialogDescription>{transition.body}</DialogDescription>
        </DialogHeader>

        {errorMessage && <Alert variant="destructive">{errorMessage}</Alert>}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? transition.pending : transition.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
