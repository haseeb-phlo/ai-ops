"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { moveSuggestionLane } from "../actions";
import type { SuggestionRow } from "./suggestion-card";

type LaneKey = "up_next" | "in_progress" | "shipped";

type Lane = {
  key: LaneKey;
  title: string;
  hint: string;
};

const LANES: Lane[] = [
  {
    key: "up_next",
    title: "Up next",
    hint: "Accepted; not yet started.",
  },
  {
    key: "in_progress",
    title: "In progress",
    hint: "Work has started.",
  },
  {
    key: "shipped",
    title: "Shipped",
    hint: "Linked intervention closed the suggestion.",
  },
];

type Groups = Record<LaneKey, SuggestionRow[]>;

/**
 * Trello-style three-column roadmap. Lane membership is computed from the
 * suggestion's `status` (after the in_progress migration: status alone
 * decides the lane), so dropping a card is a one-field update.
 *
 * Drag is super-admin only. The drop handler runs optimistically through
 * useOptimistic so the card reaches its destination before the server
 * round-trip; if the server rejects, the optimistic state reverts when the
 * page next revalidates.
 */
export function RoadmapBoard({
  groups: serverGroups,
  canMove,
}: {
  groups: Groups;
  canMove: boolean;
}) {
  const [, startTransition] = useTransition();
  const [groups, applyOptimistic] = useOptimistic(
    serverGroups,
    (state: Groups, action: { id: string; toLane: LaneKey }) => {
      // Build a mutable copy.
      const next: Groups = {
        up_next: [...state.up_next],
        in_progress: [...state.in_progress],
        shipped: [...state.shipped],
      };
      let card: SuggestionRow | undefined;
      for (const lane of LANES) {
        const idx = next[lane.key].findIndex((s) => s.id === action.id);
        if (idx >= 0) {
          card = next[lane.key][idx];
          next[lane.key].splice(idx, 1);
          break;
        }
      }
      if (card) next[action.toLane] = [card, ...next[action.toLane]];
      return next;
    },
  );

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<LaneKey | null>(null);

  function handleDrop(targetLane: LaneKey, suggestionId: string) {
    setDraggingId(null);
    setDropTarget(null);
    if (!canMove) return;
    // Apply the optimistic move and fire the server update inside the same
    // transition so React keeps both in lockstep until revalidation.
    startTransition(async () => {
      applyOptimistic({ id: suggestionId, toLane: targetLane });
      const fd = new FormData();
      fd.set("suggestion_id", suggestionId);
      fd.set("lane", targetLane);
      await moveSuggestionLane(fd);
    });
  }

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {LANES.map((lane) => {
        const items = groups[lane.key];
        const isDropTarget = dropTarget === lane.key;
        return (
          <div
            key={lane.key}
            onDragOver={
              canMove
                ? (e) => {
                    e.preventDefault();
                    setDropTarget(lane.key);
                  }
                : undefined
            }
            onDragLeave={(e) => {
              // Only clear when leaving the lane container itself, not when
              // moving across child cards within it.
              if (
                !e.currentTarget.contains(e.relatedTarget as Node | null) &&
                dropTarget === lane.key
              ) {
                setDropTarget(null);
              }
            }}
            onDrop={
              canMove
                ? (e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/suggestion-id");
                    if (id) handleDrop(lane.key, id);
                  }
                : undefined
            }
            className={cn(
              "rounded-lg border p-3 transition-colors",
              isDropTarget
                ? "border-zinc-400 bg-zinc-100"
                : "border-zinc-200 bg-zinc-50/40",
            )}
          >
            <div className="mb-3 flex items-baseline justify-between gap-2 px-1">
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-zinc-900">
                  {lane.title}
                </h3>
                <p className="text-xs text-zinc-500">{lane.hint}</p>
              </div>
              <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                {items.length}
              </span>
            </div>
            {items.length === 0 ? (
              <p className="rounded-md border border-dashed border-zinc-200 bg-white px-3 py-6 text-center text-xs text-zinc-400">
                {canMove ? "Drop a suggestion here." : "Nothing here."}
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((s) => (
                  <li
                    key={s.id}
                    draggable={canMove}
                    onDragStart={(e) => {
                      if (!canMove) return;
                      setDraggingId(s.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/suggestion-id", s.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className={cn(
                      "rounded-md border border-zinc-200 bg-white transition-opacity",
                      canMove && "cursor-grab active:cursor-grabbing",
                      draggingId === s.id && "opacity-40",
                    )}
                  >
                    <Link
                      href={`/suggestions/${s.id}`}
                      className="block p-3 hover:bg-zinc-50/60"
                    >
                      <p className="text-sm font-medium text-zinc-900">
                        {s.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">
                        {s.body}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
                        {s.team && <span>{s.team}</span>}
                        {s.team && s.workflow_name && (
                          <span aria-hidden>·</span>
                        )}
                        {s.workflow_id && s.workflow_name && (
                          <span className="hover:text-zinc-700">
                            {s.workflow_name}
                          </span>
                        )}
                        {s.intervention_id && s.intervention_name && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="text-emerald-700">
                              {s.intervention_name}
                            </span>
                          </>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
