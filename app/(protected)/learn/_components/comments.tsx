"use client";

import { useActionState, useState, useTransition } from "react";
import { format } from "date-fns";
import { MessageSquareIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  addVideoComment,
  deleteVideoComment,
} from "../actions";
import type { ActionState } from "../topics";

export type VideoComment = {
  id: string;
  body: string;
  createdAt: string;
  createdBy: string | null;
  authorName: string;
};

const initial: ActionState = { kind: "idle" };

export function Comments({
  videoId,
  currentUserId,
  isSuperAdmin,
  comments,
}: {
  videoId: string;
  currentUserId: string;
  isSuperAdmin: boolean;
  comments: VideoComment[];
}) {
  const [open, setOpen] = useState(false);
  const count = comments.length;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <MessageSquareIcon className="size-3.5" />
        {count === 0
          ? open
            ? "Hide comments"
            : "Add a comment"
          : `${count} ${count === 1 ? "comment" : "comments"}`}
      </button>

      {open && (
        <div className="space-y-3">
          {count > 0 && (
            <ul className="space-y-2">
              {comments.map((c) => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  canDelete={
                    isSuperAdmin || c.createdBy === currentUserId
                  }
                />
              ))}
            </ul>
          )}
          <CommentForm videoId={videoId} />
        </div>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  canDelete,
}: {
  comment: VideoComment;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm("Delete this comment?")) return;
    const fd = new FormData();
    fd.set("id", comment.id);
    startTransition(() => {
      void deleteVideoComment(fd);
    });
  };

  return (
    <li className="group rounded-md border border-border bg-background px-3 py-2 text-xs">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-foreground">{comment.authorName}</span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground tabular-nums">
            {format(new Date(comment.createdAt), "d MMM yyyy")}
          </span>
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="text-muted-foreground opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100 disabled:opacity-50"
              aria-label="Delete comment"
            >
              <TrashIcon className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-foreground">{comment.body}</p>
    </li>
  );
}

function CommentForm({ videoId }: { videoId: string }) {
  const [state, action, pending] = useActionState(addVideoComment, initial);
  // Re-key the Textarea on success so React mounts a fresh empty field.
  const fieldKey = state.kind === "success" ? "ok" : "draft";

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="video_id" value={videoId} />
      <Textarea
        key={fieldKey}
        name="body"
        rows={2}
        maxLength={2000}
        placeholder="Add a comment"
        required
        defaultValue=""
        className="text-xs"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Posting" : "Post"}
        </Button>
        {state.kind === "error" && (
          <span className="text-xs text-red-600">{state.message}</span>
        )}
      </div>
    </form>
  );
}
