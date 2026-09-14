"use client";

import { useActionState, useState } from "react";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Textarea } from "@/components/ui/textarea";
import { editFeedback, type EditFeedbackState } from "../actions";

export type ReviewedItem = {
  id: string;
  memberName: string;
  title: string;
  comment: string;
  decidedAt: string;
};

/**
 * What the automatic review approved on its own, and what it told people.
 *
 * The point of the list is reading, not deciding: these are already approved
 * and the member has already seen the wording. Correcting a sentence is one
 * click away, and the correction replaces what they read with no edit trail
 * on their side - a person has now written it, which is all the member needs
 * to know. The previous version is kept in the record.
 */
export function AutoApprovedList({ items }: { items: ReviewedItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Approved automatically
        </h2>
        <p className="mt-0.5 text-xs leading-normal text-muted-foreground">
          Cleared without you. Read the wording and change anything that does
          not sound right - the member sees your version.
        </p>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <ReviewedRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

function ReviewedRow({ item }: { item: ReviewedItem }) {
  const [state, action, pending] = useActionState<EditFeedbackState, FormData>(
    editFeedback,
    { kind: "idle" },
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.comment);

  const saved = state.kind === "success";

  return (
    <li className="rounded-lg border border-border bg-background p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-foreground">
          {item.memberName} - {item.title}
        </span>
        <Eyebrow>
          {new Date(item.decidedAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })}
        </Eyebrow>
      </div>

      {!editing ? (
        <>
          <p className="mt-1 text-xs leading-normal text-muted-foreground">{draft}</p>
          <div className="mt-2 flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setEditing(true)}
            >
              <PencilIcon aria-hidden />
              {saved ? "Edit again" : "Edit wording"}
            </Button>
            {saved && (
              <Eyebrow>
                Saved
              </Eyebrow>
            )}
          </div>
        </>
      ) : (
        <form
          action={(formData) => {
            setDraft(String(formData.get("comment") ?? draft));
            setEditing(false);
            return action(formData);
          }}
          className="mt-2 space-y-2"
        >
          <input type="hidden" name="submission_id" value={item.id} />
          <Textarea
            name="comment"
            defaultValue={draft}
            rows={3}
            className="text-xs"
            aria-label={`Feedback for ${item.memberName}`}
          />
          <div className="flex items-center gap-2">
            <Button type="submit" size="xs" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {state.kind === "error" && (
        <p className="mt-1 text-xs leading-normal text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </li>
  );
}
