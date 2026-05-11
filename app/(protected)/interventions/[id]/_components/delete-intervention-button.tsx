"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteIntervention } from "../actions";

/**
 * Super-admin only. Hard-deletes the intervention and its dependents
 * (snapshots, baselines, workflow links). Suggestion linkage is detached -
 * any suggestion that pointed here flips back to status `open` so it
 * doesn't dangle on the roadmap.
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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    setOpen(next);
    if (!next) setError(null);
  }

  function handleConfirm() {
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
    <>
      <Button
        type="button"
        variant="outline"
        className="text-red-700"
        onClick={() => setOpen(true)}
      >
        Delete
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete initiative?</DialogTitle>
            <DialogDescription>
              This permanently removes <strong>{interventionName}</strong>{" "}
              along with its baselines, snapshots, and workflow links. Any
              suggestions previously marked as shipped here will flip back to
              open.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-zinc-600">
            To pause or hide an initiative without losing its history, set
            its status to <strong>Retired</strong> instead.
          </p>
          {error && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700"
            >
              {error}
            </p>
          )}
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
              onClick={handleConfirm}
              disabled={isPending}
              className="bg-red-700 text-white hover:bg-red-800"
            >
              {isPending ? "Deleting..." : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
