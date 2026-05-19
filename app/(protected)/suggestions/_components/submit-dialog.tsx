"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
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

export function SubmitSuggestionDialog({
  workflows,
}: {
  workflows: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [workflowId, setWorkflowId] = useState<string>("");
  const [state, action, pending] = useActionState(createSuggestion, initial);

  // After save, close + reset.
  if (state.kind === "ok" && open) {
    setOpen(false);
    setWorkflowId("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Suggest something</Button>} />
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="gap-2 px-6 pt-5 pb-5">
          <DialogTitle>Suggest an AI initiative</DialogTitle>
          <DialogDescription>
            Pitch an idea. Suggestions are triaged by team leads;
            super-admins decide what gets built.
          </DialogDescription>
        </DialogHeader>
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
                  <SelectValue placeholder="Pick a workflow" />
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
              <p
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {state.message}
              </p>
            )}
          </div>
          <DialogFooter className="m-0 border-t border-border bg-muted/40 px-6 py-3">
            <DialogClose
              render={
                <Button type="button" variant="ghost" disabled={pending}>
                  Cancel
                </Button>
              }
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Submitting" : "Submit suggestion"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
