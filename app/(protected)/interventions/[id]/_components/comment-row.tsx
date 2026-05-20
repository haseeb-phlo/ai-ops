"use client";

import { useTransition } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { deleteInterventionComment } from "../actions";

export function InterventionCommentRow({
  id,
  interventionId,
  body,
  authorName,
  createdAt,
  canDelete,
}: {
  id: string;
  interventionId: string;
  body: string;
  authorName: string;
  createdAt: string;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <li className="px-4 py-3 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium text-foreground">{authorName}</p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            {format(new Date(createdAt), "d MMM yyyy")}
          </span>
          {canDelete && (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="text-muted-foreground hover:text-red-700"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const fd = new FormData();
                  fd.set("comment_id", id);
                  fd.set("intervention_id", interventionId);
                  await deleteInterventionComment(fd);
                })
              }
            >
              Delete
            </Button>
          )}
        </div>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-foreground">{body}</p>
    </li>
  );
}
