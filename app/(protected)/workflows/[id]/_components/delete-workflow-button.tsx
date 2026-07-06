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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      const result = await softDeleteWorkflow(workflowId);
      if (result?.kind === "error") {
        setError(result.message);
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
          <DialogTitle>Delete this workflow?</DialogTitle>
          <DialogDescription>
            <strong>{workflowName}</strong> and its history stay in the
            database, but it is hidden everywhere in the app. A super admin
            can restore it from the Admin tab.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-workflow-name">
            Type the workflow name to confirm
          </Label>
          <Input
            id="confirm-workflow-name"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Workflow name"
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
            {isPending ? "Deleting…" : "Delete workflow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
