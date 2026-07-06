"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * State contract shared with the comment Server Actions. Structurally
 * compatible with the per-area state types (e.g. `CommentState`,
 * `SuggestionState`) - extra optional fields on the "ok" variant are fine.
 */
export type CommentFormState =
  | { kind: "idle" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

const initial: CommentFormState = { kind: "idle" };

/**
 * Shared comment composer. The Server Action arrives as a prop from the
 * owning Server Component; the resource id travels in a hidden field
 * (`hiddenFieldName`/`hiddenFieldValue`, e.g. "intervention_id").
 *
 * On success the Textarea is re-keyed so React mounts a fresh uncontrolled
 * element with an empty value - same pattern the per-area copies used.
 */
export function CommentForm({
  action,
  hiddenFieldName,
  hiddenFieldValue,
  placeholder = "Add a comment",
}: {
  action: (
    state: CommentFormState,
    formData: FormData,
  ) => Promise<CommentFormState>;
  hiddenFieldName: string;
  hiddenFieldValue: string;
  placeholder?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const fieldKey = state.kind === "ok" ? "ok" : "draft";

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name={hiddenFieldName} value={hiddenFieldValue} />
      <Textarea
        key={fieldKey}
        name="body"
        rows={3}
        maxLength={2000}
        placeholder={placeholder}
        required
        defaultValue=""
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" loading={pending}>
          {pending ? "Posting…" : "Post comment"}
        </Button>
        {state.kind === "error" && (
          <span className="text-xs text-destructive">{state.message}</span>
        )}
      </div>
    </form>
  );
}
