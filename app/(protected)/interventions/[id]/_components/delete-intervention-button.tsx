"use client";

import { useState } from "react";
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
import { deleteIntervention } from "../actions";

/**
 * Super-admin only. Hard-deletes the intervention and its dependents
 * (snapshots, baselines, workflow links). Suggestion linkage is detached -
 * any suggestion that pointed here flips back to status `open` so it
 * doesn't dangle on the roadmap.
 *
 * Uses a confirmation dialog because this is irreversible. Status =
 * "Retired" should be the day-to-day move; this button is for sample data,
 * accidental dupes, and similar permanent removals.
 */
export function DeleteInterventionButton({
  interventionId,
  interventionName,
}: {
  interventionId: string;
  interventionName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" className="text-red-700">
            Delete
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete intervention?</DialogTitle>
          <DialogDescription>
            This permanently removes <strong>{interventionName}</strong>{" "}
            along with its baselines, snapshots, and workflow links. Any
            suggestions previously marked as shipped here will flip back to
            open.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-zinc-600">
          To pause or hide an intervention without losing its history, set
          its status to <strong>Retired</strong> instead.
        </p>
        <DialogFooter>
          <DialogClose
            render={<Button type="button" variant="ghost">Cancel</Button>}
          />
          <form action={deleteIntervention}>
            <input type="hidden" name="id" value={interventionId} />
            <Button type="submit" className="bg-red-700 text-white hover:bg-red-800">
              Delete permanently
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
