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
import { deleteSuggestion } from "../../actions";

export function DeleteSuggestionButton({
  suggestionId,
  title,
}: {
  suggestionId: string;
  title: string;
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
          <DialogTitle>Delete suggestion?</DialogTitle>
          <DialogDescription>
            Permanently removes <strong>{title}</strong> and all its
            comments and votes. Use Decline if you want to keep the audit
            trail visible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose
            render={<Button type="button" variant="ghost">Cancel</Button>}
          />
          <form
            action={async (fd) => {
              fd.set("suggestion_id", suggestionId);
              await deleteSuggestion(fd);
              window.location.href = "/suggestions";
            }}
          >
            <Button
              type="submit"
              className="bg-red-700 text-white hover:bg-red-800"
            >
              Delete permanently
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
