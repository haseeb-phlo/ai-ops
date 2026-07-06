"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Time } from "@/components/ui/time";

/**
 * Shared comment row. Renders author, a relative timestamp (exact local
 * date + time recoverable on hover via the shared Time component), and the
 * body. Delete is two-step: the first click arms an inline
 * "Confirm delete?" pair, so a stray click can't destroy a comment, and no
 * window.confirm is involved.
 *
 * The delete Server Action arrives as a prop from the owning Server
 * Component; the resource id travels in `hiddenFieldName`/`hiddenFieldValue`
 * (e.g. "suggestion_id") alongside the `comment_id` field.
 */
export function CommentRow({
  commentId,
  authorName,
  createdAt,
  body,
  canDelete,
  deleteAction,
  hiddenFieldName,
  hiddenFieldValue,
}: {
  commentId: string;
  authorName: string;
  /** ISO timestamp of the comment. */
  createdAt: string;
  body: string;
  canDelete: boolean;
  deleteAction: (formData: FormData) => Promise<unknown>;
  hiddenFieldName: string;
  hiddenFieldValue: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("comment_id", commentId);
      fd.set(hiddenFieldName, hiddenFieldValue);
      await deleteAction(fd);
    });
  }

  return (
    <li className="px-4 py-3 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium text-foreground">{authorName}</p>
        <div className="flex items-center gap-2">
          <Time
            iso={createdAt}
            relative
            className="text-xs text-muted-foreground tabular-nums"
          />
          {canDelete &&
            (confirming ? (
              <span className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  Confirm delete?
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="destructive"
                  loading={pending}
                  onClick={handleDelete}
                >
                  Delete
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </Button>
              </span>
            ) : (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setConfirming(true)}
              >
                Delete
              </Button>
            ))}
        </div>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-foreground">{body}</p>
    </li>
  );
}
