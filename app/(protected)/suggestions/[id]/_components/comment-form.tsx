"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  createSuggestionComment,
  type SuggestionState,
} from "../../actions";

const initial: SuggestionState = { kind: "idle" };

export function CommentForm({ suggestionId }: { suggestionId: string }) {
  const [state, action, pending] = useActionState(
    createSuggestionComment,
    initial,
  );
  // Re-key the Textarea on each successful post so React mounts a fresh
  // uncontrolled element with empty value. Cleaner than juggling controlled
  // state + an effect and avoids tripping the no-set-state-in-effect rule.
  const fieldKey = state.kind === "ok" ? "ok" : "draft";

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="suggestion_id" value={suggestionId} />
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
