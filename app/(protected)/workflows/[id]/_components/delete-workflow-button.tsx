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
import { softDeleteWorkflow } from "../../actions";

export function DeleteWorkflowButton({
  workflowId,
  workflowName,
}: {
  workflowId: string;
  workflowName: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canConfirm = confirmText.trim() === workflowName.trim();

  function handleOpenChange(next: boolean) {
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
      const result = await softDeleteWorkflow(workflowId);
      if (result?.kind === "error") {
        setError(result.message);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-red-200 text-red-700 hover:bg-red-50"
      >
        Delete
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this workflow?</DialogTitle>
            <DialogDescription>
              The workflow and its history stay in the database, but it is
              hidden everywhere in the app. A super admin can restore it from
              the Admin tab.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm">
            <p className="text-foreground">
              Type{" "}
              <span className="rounded bg-muted px-1 font-medium text-foreground">
                {workflowName}
              </span>{" "}
              to confirm.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder={workflowName}
            />
          </div>

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
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm || isPending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isPending ? "Deleting…" : "Delete workflow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
