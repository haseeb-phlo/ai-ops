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
import { createRoadmapItem, type RoadmapState } from "../actions";

const initial: RoadmapState = { kind: "idle" };

const LANE_OPTIONS = [
  { value: "accepted", label: "Accepted - committed, not yet prioritised" },
  { value: "queued", label: "Queued - joins the bottom of the queue" },
  { value: "in_progress", label: "In progress - already underway" },
] as const;

/**
 * Super-admin shortcut past the suggestion funnel: adds an item straight
 * onto the roadmap in a committed lane. Dialog shell mirrors the
 * suggestions submit dialog - the form lives in a keyed child so action
 * state resets on every open.
 */
export function AddRoadmapItemDialog({
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
      <DialogTrigger render={<Button>Add to roadmap</Button>} />
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="gap-2 px-6 pt-5 pb-5">
          <DialogTitle>Add to the roadmap</DialogTitle>
          <DialogDescription>
            Add work directly to the roadmap, skipping the suggestion
            funnel. Visible to everyone.
          </DialogDescription>
        </DialogHeader>
        <AddRoadmapItemForm
          key={formKey}
          workflows={workflows}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function AddRoadmapItemForm({
  workflows,
  onSuccess,
  onCancel,
}: {
  workflows: { id: string; name: string }[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [workflowId, setWorkflowId] = useState<string>("");
  const [lane, setLane] = useState<string>("queued");
  const [state, action, pending] = useActionState(createRoadmapItem, initial);

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
            placeholder="e.g. Roll out AI triage to the dispensary team"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="body">What it is</Label>
          <Textarea
            id="body"
            name="body"
            required
            minLength={5}
            maxLength={2000}
            rows={5}
            placeholder="What's being built and why. Everyone across the company can read this."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lane">Lane</Label>
          <input type="hidden" name="lane" value={lane} />
          <Select value={lane} onValueChange={(v) => setLane(v ?? "queued")}>
            <SelectTrigger id="lane" className="w-full">
              <SelectValue>
                {(v) =>
                  LANE_OPTIONS.find((o) => o.value === v)?.label ?? ""
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LANE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="workflow_id">Workflow this helps (optional)</Label>
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
          {pending ? "Adding" : "Add to roadmap"}
        </Button>
      </DialogFooter>
    </form>
  );
}
