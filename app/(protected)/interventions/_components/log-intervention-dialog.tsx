"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import {
  logIntervention,
  type LogInterventionState,
} from "../actions";

const TYPES = [
  { value: "tool", label: "Tool" },
  { value: "training", label: "Training" },
  { value: "prompt", label: "Prompt" },
  { value: "agent", label: "Agent" },
  { value: "automation", label: "Automation" },
  { value: "process_change", label: "Process change" },
] as const;

export function LogInterventionDialog({
  open,
  onOpenChange,
  workflows,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflows: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<LogInterventionState, FormData>(
    logIntervention,
    { kind: "idle" },
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [type, setType] = useState<string>("");
  const [confidence, setConfidence] = useState<string>("medium");

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSelected(new Set());
      setType("");
      setConfidence("medium");
    }
    onOpenChange(next);
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log new intervention</DialogTitle>
          <DialogDescription>
            Capture a tool, prompt, training session or process change you&apos;ve
            shipped. We&apos;ll snapshot the current workflow metrics as the
            baseline.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={200} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>
            {/* Hidden input carries the value into the form;
                Base UI Select doesn't post a native form value. */}
            <input type="hidden" name="type" value={type} />
            <Select value={type} onValueChange={(v) => setType(v ?? "")}>
              <SelectTrigger id="type" className="w-full">
                <SelectValue placeholder="Pick one…" />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Affected workflows</Label>
            <div className="max-h-44 overflow-y-auto rounded-lg border border-input">
              {workflows.length === 0 ? (
                <div className="px-3 py-3 text-sm text-zinc-400">
                  No workflows yet - create one first.
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {workflows.map((w) => (
                    <li key={w.id}>
                      <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-50">
                        <input
                          type="checkbox"
                          name="workflow_ids"
                          value={w.id}
                          checked={selected.has(w.id)}
                          onChange={() => toggle(w.id)}
                          className="size-4"
                        />
                        <span className="text-zinc-900">{w.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              {selected.size} selected - at least one required.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              maxLength={500}
              placeholder="One-line summary (optional)"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="minutes_saved_per_week">
              Estimated minutes saved per week
            </Label>
            <Input
              id="minutes_saved_per_week"
              name="minutes_saved_per_week"
              type="number"
              min={0}
              step={1}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="attribution_confidence">
              Attribution confidence
            </Label>
            <input
              type="hidden"
              name="attribution_confidence"
              value={confidence}
            />
            <Select
              value={confidence}
              onValueChange={(v) => setConfidence(v ?? "medium")}
            >
              <SelectTrigger id="attribution_confidence" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">
                  High - clean before/after, isolated change
                </SelectItem>
                <SelectItem value="medium">
                  Medium - confounded by other changes
                </SelectItem>
                <SelectItem value="low">
                  Low - best-guess; many things moved at once
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-zinc-500">
              How sure are you the impact is from this intervention? Weighted on
              the dashboard: high ×1.0, medium ×0.7, low ×0.4.
            </p>
          </div>

          {state.kind === "error" && (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-inset ring-red-200"
            >
              {state.message}
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
            <SubmitButton disabled={selected.size === 0 || type === ""} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending}>
      {pending ? "Logging…" : "Log intervention"}
    </Button>
  );
}
