"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  createInterventionComment,
  type CommentState,
} from "../actions";

const initial: CommentState = { kind: "idle" };

export function InterventionCommentForm({
  interventionId,
}: {
  interventionId: string;
}) {
  const [state, action, pending] = useActionState(
    createInterventionComment,
    initial,
  );
  // Re-key the Textarea after a successful post so React mounts a fresh
  // uncontrolled element with empty value - same pattern the suggestion
  // and learn-video comment forms use.
  const fieldKey = state.kind === "ok" ? "ok" : "draft";

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="intervention_id" value={interventionId} />
      <Textarea
        key={fieldKey}
        name="body"
        rows={3}
        maxLength={2000}
        placeholder="Add a comment"
        required
        defaultValue=""
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Posting" : "Post comment"}
        </Button>
        {state.kind === "error" && (
          <span className="text-xs text-red-600">{state.message}</span>
        )}
      </div>
    </form>
  );
}
