"use client";

import { useActionState, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { createSuggestion, type SuggestionState } from "../actions";

const initial: SuggestionState = { kind: "idle" };

/**
 * Dialog shell. The form (and its useActionState) lives in a keyed child:
 * the key is bumped on every open so the action state resets to idle. That
 * means a previous success can never instantly re-close the dialog on
 * reopen, stale errors never resurface, and "submit two in a row" works.
 */
export function SubmitSuggestionDialog({
  workflows,
}: {
  workflows: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const handleOpenChange = (next: boolean) => {
    if (next) setFormKey((k) => k + 1);
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button>Suggest something</Button>} />
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="gap-2 px-6 pt-5 pb-5">
          <DialogTitle>Suggest an AI initiative</DialogTitle>
          <DialogDescription>
            Pitch an idea. Suggestions are triaged by team leads;
            super-admins decide what gets built.
          </DialogDescription>
        </DialogHeader>
        <SubmitSuggestionForm
          key={formKey}
          workflows={workflows}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function SubmitSuggestionForm({
  workflows,
  onSuccess,
  onCancel,
}: {
  workflows: { id: string; name: string }[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [workflowId, setWorkflowId] = useState<string>("");
  const [state, action, pending] = useActionState(createSuggestion, initial);

  useEffect(() => {
    if (state.kind === "ok") onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={action} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto border-t border-border px-6 py-5">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            required
            maxLength={200}
            placeholder="e.g. Auto-summarise prescription queries"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="body">What you&apos;d want it to do</Label>
          <Textarea
            id="body"
            name="body"
            required
            minLength={5}
            maxLength={2000}
            rows={5}
            placeholder="Describe the problem and how AI could help. Anyone on the team can read this, so paint the picture."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="workflow_id">Workflow this would help (optional)</Label>
          <input type="hidden" name="workflow_id" value={workflowId} />
          <Select
            value={workflowId}
            onValueChange={(v) => setWorkflowId(v ?? "")}
          >
            <SelectTrigger id="workflow_id" className="w-full">
              <SelectValue placeholder="Pick a workflow">
                {(v) => workflows.find((w) => w.id === v)?.name ?? ""}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {workflows.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {state.kind === "error" && (
          <Alert variant="destructive">{state.message}</Alert>
        )}
      </div>
      <DialogFooter className="m-0 border-t border-border bg-muted/40 px-6 py-3">
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {pending ? "Submitting" : "Submit suggestion"}
        </Button>
      </DialogFooter>
    </form>
  );
}
