"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteIntervention } from "../actions";

/**
 * Super-admin only. Hard-deletes the intervention and its dependents
 * (snapshots, baselines, workflow links). Suggestion linkage is detached -
 * any suggestion that pointed here flips back to status `open` so it
 * doesn't dangle on the roadmap.
 *
 * Because the delete is permanent and cascading, it requires typing the
 * initiative's name to confirm - deliberately more friction than the
 * recoverable workflow soft-delete.
 *
 * Calls the action inside a transition and routes manually on success.
 * An earlier version posted to the action via <form action={...}> and
 * relied on Server Action redirect, but inside a base-ui Dialog that
 * left the dialog mounted on the now-404 detail page until the user
 * refreshed.
 */
export function DeleteInterventionButton({
  interventionId,
  interventionName,
}: {
  interventionId: string;
  interventionName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canConfirm = confirmText.trim() === interventionName.trim();

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    setOpen(next);
    if (!next) {
      setConfirmText("");
      setError(null);
    }
  }

  function handleConfirm() {
    if (!canConfirm) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteIntervention(interventionId);
        if (result.kind === "ok") {
          setOpen(false);
          router.push("/interventions");
          router.refresh();
          return;
        }
        setError(result.message);
      } catch (err) {
        console.error("deleteIntervention threw", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unexpected error while deleting.",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button type="button" variant="destructive">
            Delete
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete AI initiative?</DialogTitle>
          <DialogDescription>
            This <strong>permanently</strong> deletes{" "}
            <strong>{interventionName}</strong>, along with its baselines,
            metric snapshots, and workflow links. Any suggestions previously
            marked as shipped by it flip back to open. This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          To keep the history, set the status to <strong>Retired</strong>{" "}
          instead.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-initiative-name">
            Type the initiative name to confirm
          </Label>
          <Input
            id="confirm-initiative-name"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Initiative name"
            autoComplete="off"
          />
        </div>

        {error && <Alert variant="destructive">{error}</Alert>}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm || isPending}
          >
            {isPending ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
