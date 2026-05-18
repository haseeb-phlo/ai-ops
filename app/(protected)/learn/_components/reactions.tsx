"use client";

import { useState, useTransition } from "react";
import { SmilePlusIcon } from "lucide-react";
import { toggleVideoReaction } from "../actions";
import { REACTION_EMOJIS } from "../topics";

export type ReactionEntry = {
  emoji: string;
  userId: string;
  userName: string;
};

export function Reactions({
  videoId,
  currentUserId,
  reactions,
}: {
  videoId: string;
  currentUserId: string;
  reactions: ReactionEntry[];
}) {
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

  // Group reactions by emoji, preserving insertion order across pills.
  const groups = new Map<string, ReactionEntry[]>();
  for (const r of reactions) {
    let list = groups.get(r.emoji);
    if (!list) {
      list = [];
      groups.set(r.emoji, list);
    }
    list.push(r);
  }

  const toggle = (emoji: string) => {
    setPickerOpen(false);
    const fd = new FormData();
    fd.set("video_id", videoId);
    fd.set("emoji", emoji);
    startTransition(() => {
      void toggleVideoReaction(fd);
    });
  };

  const usedEmojis = new Set(groups.keys());
  const pickerOptions = REACTION_EMOJIS.filter((e) => !usedEmojis.has(e));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {Array.from(groups.entries()).map(([emoji, entries]) => {
        const mine = entries.some((e) => e.userId === currentUserId);
        const names = entries.map((e) => e.userName).join(", ");
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => toggle(emoji)}
            disabled={pending}
            title={names}
            aria-label={`${emoji} reacted by ${names}. Click to ${mine ? "remove your" : "add your"} reaction.`}
            className={
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-none transition-colors disabled:opacity-60 " +
              (mine
                ? "border-foreground/30 bg-foreground/5 text-foreground"
                : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground")
            }
          >
            <span className="text-sm leading-none">{emoji}</span>
            <span className="tabular-nums">{entries.length}</span>
          </button>
        );
      })}

      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          disabled={pending}
          aria-label="Add reaction"
          aria-expanded={pickerOpen}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs leading-none text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-60"
        >
          <SmilePlusIcon className="size-3.5" />
        </button>
        {pickerOpen && (
          <>
            {/* Backdrop to dismiss on outside click. */}
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={() => setPickerOpen(false)}
              className="fixed inset-0 z-10 cursor-default"
            />
            <div className="absolute bottom-full left-0 z-20 mb-1 flex gap-1 rounded-lg border border-border bg-background p-1 shadow-md">
              {pickerOptions.length === 0 ? (
                <span className="px-2 py-1 text-xs text-muted-foreground">
                  All reactions used
                </span>
              ) : (
                pickerOptions.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => toggle(emoji)}
                    className="rounded p-1 text-base leading-none transition-colors hover:bg-muted"
                    aria-label={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
