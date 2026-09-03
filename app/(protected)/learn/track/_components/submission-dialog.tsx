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
 * Work samples are the odd one out: artefact only, always private, and never
 * shown to peers - they feed the anonymised export for external blind
 * scoring, so asking for a prompt or offering to share would be misleading.
 * Their brief lives on the card rather than in here - see TrackItemCard.
 */
export function SubmissionDialog({
  cohortId,
  trackItemId,
  title,
  kind,
  isResubmission,
  rejectionComment,
}: {
  /** Which cohort to file this against. See TrackItemCard. */
  cohortId: string;
  trackItemId: string;
  title: string;
  kind: string;
  isResubmission: boolean;
  rejectionComment?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isWorkSample = kind.startsWith("work_sample");

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
            {/* The work-sample brief - what counts, that it is not meant to
                be tidied, that it is private - now sits on the card, where it
                can be read before deciding to click. What is left here is the
                one thing the form still needs to say. */}
            {isWorkSample
              ? "A link to the work is all this needs."
              : "Share what you made with Claude and the prompt behind it. Your team lead signs it off."}
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
            <Label htmlFor="artefact_url">
              {isWorkSample ? "Link to the work" : "Link to what you made"}
            </Label>
            <Input
              id="artefact_url"
              name="artefact_url"
              type="url"
              placeholder="https://…"
              // Required for a work sample, which has no other field: without
              // it the form submits empty and ticks the slot off. The server
              // enforces this too - this only saves a round trip.
              required={isWorkSample}
            />
            {/* The step people get stuck on. A Claude conversation is private
                by default, so pasting the address from the browser bar gives
                a link only the author can open - it looks fine to them and
                404s for everyone else.

                Numbered, not prose. This was one paragraph carrying three
                separate instructions plus a warning, which is exactly the
                shape people skim past - and the run-on ran two words
                together where an inline <strong> met a line break. */}
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-foreground">
                Getting a link other people can open
              </p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                <li>Open the conversation in Claude.</li>
                <li>Use Share to create a public link.</li>
                <li>Copy that link. It looks like claude.ai/share/…</li>
              </ol>
              <p className="mt-2 text-xs text-muted-foreground">
                The address in your browser bar is not the same thing, and
                nobody else can open it.
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Worth checking: paste it into a private window. If it opens
                without asking you to sign in, it will open for us.
              </p>
            </div>
          </div>

          {!isWorkSample && (
            <>
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
            </>
          )}

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
