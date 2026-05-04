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
import {
  createWorkflow,
  type CreateWorkflowState,
} from "../actions";

const CRITICALITY_LABELS = ["1 — Trivial", "2 — Low", "3 — Medium", "4 — High", "5 — Critical"];

export function NewWorkflowDialog({
  teams,
  defaultTeam,
}: {
  teams: string[];
  defaultTeam: string;
}) {
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState(defaultTeam);
  const [criticality, setCriticality] = useState("3");

  const [state, action, pending] = useActionState<
    CreateWorkflowState,
    FormData
  >(createWorkflow, { kind: "idle" });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Add new workflow</Button>} />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add new workflow</DialogTitle>
          <DialogDescription>
            Describe how you do this work today. Claude will turn the description
            into structured steps you can edit later.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Workflow name</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="e.g. Weekly stock count"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="team">Owner team</Label>
              {/* Hidden input is what actually gets submitted —
                  shadcn Select doesn't post a native form value. */}
              <input type="hidden" name="team" value={team} />
              <Select
                value={team}
                onValueChange={(v) => setTeam(v ?? "")}
              >
                <SelectTrigger id="team">
                  <SelectValue placeholder="Pick a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                  {teams.length === 0 && (
                    <SelectItem value={defaultTeam || "unknown"}>
                      {defaultTeam || "(none)"}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency_per_week">Frequency per week</Label>
              <Input
                id="frequency_per_week"
                name="frequency_per_week"
                type="number"
                step="0.5"
                min="0"
                defaultValue="1"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="criticality_score">Criticality (1–5)</Label>
              <input
                type="hidden"
                name="criticality_score"
                value={criticality}
              />
              <Select
                value={criticality}
                onValueChange={(v) => setCriticality(v ?? "3")}
              >
                <SelectTrigger id="criticality_score">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRITICALITY_LABELS.map((label, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="business_kpi">Business KPI (optional)</Label>
              <Input
                id="business_kpi"
                name="business_kpi"
                placeholder="e.g. Order accuracy"
              />
            </div>

            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="regulatory_flag"
                name="regulatory_flag"
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300"
              />
              <Label htmlFor="regulatory_flag" className="font-normal">
                This workflow has regulatory implications
              </Label>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="walkthrough">Walk through what you do</Label>
              <Textarea
                id="walkthrough"
                name="walkthrough"
                rows={8}
                required
                minLength={20}
                placeholder="In plain English, describe how this gets done step by step. Talk like you're explaining it to a new joiner. Claude will turn this into structured steps."
              />
            </div>
          </div>

          {state.kind === "error" && (
            <p
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {state.message}
            </p>
          )}

          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={pending}>
                  Cancel
                </Button>
              }
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Saving + extracting steps…" : "Create workflow"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
