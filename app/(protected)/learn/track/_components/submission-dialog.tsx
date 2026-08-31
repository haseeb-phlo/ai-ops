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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitProgrammeSubmission } from "../actions";

/**
 * The member-facing submission form.
 *
 * One shape for every slot. It used to branch on kind, because work samples
 * asked for the artefact alone - those are gone from the track, and with them
 * the only submission that was private, self-approving and prompt-less.
 */
export function SubmissionDialog({
  cohortId,
  trackItemId,
  title,
  isResubmission,
  rejectionComment,
}: {
  /** Which cohort to file this against. See TrackItemCard. */
  cohortId: string;
  trackItemId: string;
  title: string;
  isResubmission: boolean;
  rejectionComment?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    setError(null);
    formData.set("track_item_id", trackItemId);
    formData.set("cohort_id", cohortId);
    startTransition(async () => {
      const result = await submitProgrammeSubmission(formData);
      if (result.kind === "error") setError(result.message);
      else setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            {isResubmission ? "Submit again" : "Submit"}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Share what you made and the prompt behind it. Your team lead signs
            it off.
          </DialogDescription>
        </DialogHeader>

        {rejectionComment && (
          <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
            <p className="font-medium text-foreground">
              Feedback on your last attempt
            </p>
            <p className="mt-1 text-muted-foreground">{rejectionComment}</p>
          </div>
        )}

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="artefact_url">Link to what you made</Label>
            <Input
              id="artefact_url"
              name="artefact_url"
              type="url"
              placeholder="https://…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prompt_text">The prompt you used</Label>
            <Textarea id="prompt_text" name="prompt_text" rows={4} required />
            <p className="text-xs text-muted-foreground">
              This is what makes the gallery useful to everyone else.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task_solved">What it solved</Label>
            <Input id="task_solved" name="task_solved" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="time_saved_estimate">Time saved</Label>
            <Input
              id="time_saved_estimate"
              name="time_saved_estimate"
              placeholder="e.g. 2 hours a week"
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="share_publicly"
              defaultChecked
              className="mt-0.5"
            />
            <span>
              Add to the company prompt library once approved
              <span className="block text-xs text-muted-foreground">
                Untick to keep it to your cohort.
              </span>
            </span>
          </label>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
