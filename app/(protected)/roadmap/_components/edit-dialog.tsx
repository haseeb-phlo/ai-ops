"use client";

import { useActionState, useEffect, useState } from "react";
import { PencilIcon } from "lucide-react";
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
import { WorkflowMultiSelect } from "@/components/workflow-multi-select";
import {
  editSuggestion,
  type SuggestionState,
} from "../../suggestions/actions";

const initial: SuggestionState = { kind: "idle" };

/**
 * In-place edit for a suggestion card on the board: title, pitch, and
 * workflow links. Lane changes stay with drag-drop and status actions.
 * Same keyed-form-reset shell as the add dialog.
 */
export function EditRoadmapItemDialog({
  suggestionId,
  title,
  body,
  workflowIds,
  workflows,
}: {
  suggestionId: string;
  title: string;
  body: string;
  workflowIds: string[];
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
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={`Edit ${title}`}
            className="flex shrink-0 cursor-pointer items-start rounded-r-md px-1.5 py-2 text-muted-foreground/50 outline-none transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:bg-muted/40 focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:inset-ring-2 focus-visible:inset-ring-primary"
          >
            <PencilIcon aria-hidden className="size-3" />
          </button>
        }
      />
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="gap-2 px-6 pt-5 pb-5">
          <DialogTitle>Edit roadmap item</DialogTitle>
          <DialogDescription>
            Changes show everywhere this item appears.
          </DialogDescription>
        </DialogHeader>
        <EditRoadmapItemForm
          key={formKey}
          suggestionId={suggestionId}
          title={title}
          body={body}
          workflowIds={workflowIds}
          workflows={workflows}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditRoadmapItemForm({
  suggestionId,
  title,
  body,
  workflowIds,
  workflows,
  onSuccess,
  onCancel,
}: {
  suggestionId: string;
  title: string;
  body: string;
  workflowIds: string[];
  workflows: { id: string; name: string }[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(editSuggestion, initial);

  useEffect(() => {
    if (state.kind === "ok") onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={action} className="flex min-h-0 flex-1 flex-col">
      <input type="hidden" name="suggestion_id" value={suggestionId} />
      <div className="flex-1 space-y-4 overflow-y-auto border-t border-border px-6 py-5">
        <div className="space-y-1.5">
          <Label htmlFor="edit-title">Title</Label>
          <Input
            id="edit-title"
            name="title"
            required
            maxLength={200}
            defaultValue={title}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-body">What it is</Label>
          <Textarea
            id="edit-body"
            name="body"
            required
            minLength={5}
            maxLength={2000}
            rows={5}
            defaultValue={body}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Workflows this helps (optional)</Label>
          <WorkflowMultiSelect
            workflows={workflows}
            defaultSelected={workflowIds}
          />
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
          {pending ? "Saving" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
