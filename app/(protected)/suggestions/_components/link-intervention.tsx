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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  linkSuggestionsToIntervention,
  type SuggestionState,
} from "../actions";

const initial: SuggestionState = { kind: "idle" };

/**
 * Super-admin only flow: take this suggestion (and optionally other open
 * ones) and mark them as `shipped` against an existing intervention. This
 * is how multiple suggestions can be addressed by a single intervention.
 *
 * Dialog shell + keyed form child so useActionState resets on every open —
 * a previous success can't instantly re-close the dialog and stale errors
 * never resurface (see SubmitSuggestionDialog).
 */
export function LinkInterventionDialog({
  suggestionId,
  interventions,
}: {
  suggestionId: string;
  interventions: { id: string; name: string }[];
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
          <Button type="button" size="sm" variant="outline">
            Mark shipped
          </Button>
        }
      />
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="gap-2 px-6 pt-5 pb-5">
          <DialogTitle>Mark as shipped</DialogTitle>
          <DialogDescription>
            Link this suggestion to the AI initiative that addressed it. Both
            sides become navigable from each other.
          </DialogDescription>
        </DialogHeader>
        <LinkInterventionForm
          key={formKey}
          suggestionId={suggestionId}
          interventions={interventions}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function LinkInterventionForm({
  suggestionId,
  interventions,
  onSuccess,
  onCancel,
}: {
  suggestionId: string;
  interventions: { id: string; name: string }[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [interventionId, setInterventionId] = useState<string>("");
  const [state, action, pending] = useActionState(
    linkSuggestionsToIntervention,
    initial,
  );

  useEffect(() => {
    if (state.kind === "ok") onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={action} className="flex min-h-0 flex-1 flex-col">
      <input type="hidden" name="suggestion_ids" value={suggestionId} />
      <div className="flex-1 space-y-3 overflow-y-auto border-t border-border px-6 py-5">
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Initiative{" "}
            <span aria-hidden className="text-destructive">
              *
            </span>
            <span className="sr-only">(required)</span>
          </label>
          <input
            type="hidden"
            name="intervention_id"
            value={interventionId}
          />
          <Select
            value={interventionId}
            onValueChange={(v) => setInterventionId(v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pick an AI initiative">
                {(v) => interventions.find((iv) => iv.id === v)?.name ?? ""}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {interventions.map((iv) => (
                <SelectItem key={iv.id} value={iv.id}>
                  {iv.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {state.kind === "error" && (
          <Alert variant="destructive">{state.message}</Alert>
        )}
      </div>
      <DialogFooter className="m-0 items-center border-t border-border bg-muted/40 px-6 py-3">
        {!interventionId && (
          <span className="mr-auto text-xs text-muted-foreground">
            Choose an initiative to link
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!interventionId} loading={pending}>
          {pending ? "Linking" : "Mark shipped"}
        </Button>
      </DialogFooter>
    </form>
  );
}
