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
 */
export function LinkInterventionDialog({
  suggestionId,
  interventions,
}: {
  suggestionId: string;
  interventions: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [interventionId, setInterventionId] = useState<string>("");
  const [state, action, pending] = useActionState(
    linkSuggestionsToIntervention,
    initial,
  );

  if (state.kind === "ok" && open) {
    setOpen(false);
    setInterventionId("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            Link this suggestion to the intervention that addressed it. Both
            sides become navigable from each other.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex min-h-0 flex-1 flex-col">
          <input
            type="hidden"
            name="suggestion_ids"
            value={suggestionId}
          />
          <div className="flex-1 space-y-3 overflow-y-auto border-t border-border px-6 py-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Intervention
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
                  <SelectValue placeholder="Pick an intervention" />
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
            <Button type="submit" disabled={pending || !interventionId}>
              {pending ? "Linking" : "Mark shipped"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
