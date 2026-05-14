"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { GripVertical } from "lucide-react";
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
    hint: "Linked AI initiative closed the suggestion.",
  },
];

type Groups = Record<LaneKey, SuggestionRow[]>;

export type RoadmapInitiative = {
  id: string;
  name: string;
  team: string | null;
};

/**
 * Trello-style three-column roadmap. Lane membership is computed from the
 * suggestion's `status` (after the in_progress migration: status alone
 * decides the lane), so dropping a card is a one-field update.
 *
 * Drag is super-admin only. The drop handler runs optimistically through
 * useOptimistic so the card reaches its destination before the server
 * round-trip; if the server rejects, the optimistic state reverts when the
 * page next revalidates.
 *
 * Active AI initiatives also surface in the In progress lane so logged
 * work shows up even without a matching suggestion. They share the card
 * shape and are marked only by a small emerald accent dot; not draggable.
 */
export function RoadmapBoard({
  groups: serverGroups,
  canMove,
  inProgressInitiatives = [],
}: {
  groups: Groups;
  canMove: boolean;
  inProgressInitiatives?: RoadmapInitiative[];
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
        const initiatives =
          lane.key === "in_progress" ? inProgressInitiatives : [];
        const isDropTarget = dropTarget === lane.key;
        const totalCount = items.length + initiatives.length;
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
                ? "border-input bg-muted"
                : "border-border bg-muted/40/40",
            )}
          >
            <div className="mb-3 flex items-baseline justify-between gap-2 px-1">
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  {lane.title}
                </h3>
                <p className="text-xs text-muted-foreground">{lane.hint}</p>
              </div>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {totalCount}
              </span>
            </div>
            {totalCount === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-background px-3 py-6 text-center text-xs text-muted-foreground">
                {canMove ? "Drop a suggestion here." : "Nothing here."}
              </p>
            ) : (
              <ul className="space-y-2">
                {initiatives.map((iv) => (
                  <li
                    key={`initiative:${iv.id}`}
                    className="rounded-md border border-border bg-background"
                  >
                    <Link
                      href={`/interventions/${iv.id}`}
                      className="flex items-start gap-2.5 p-3 hover:bg-muted/40"
                    >
                      <span
                        aria-hidden
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {iv.name}
                        </p>
                        {iv.team && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {iv.team}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
                {items.map((s) => (
                  <SuggestionCardItem
                    key={s.id}
                    suggestion={s}
                    canMove={canMove}
                    isDragging={draggingId === s.id}
                    onDragStart={() => setDraggingId(s.id)}
                    onDragEnd={() => setDraggingId(null)}
                  />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}

/**
 * Suggestion card with a dedicated grip handle column. The drag handlers
 * live on the handle, not on the card wrapper, so the body's Link is never
 * the drag source - eliminating the anchor-default-drag interference that
 * makes a draggable <li> wrapping a Link silently fail. Pattern mirrors
 * Linear / Asana / Trello boards.
 */
function SuggestionCardItem({
  suggestion: s,
  canMove,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  suggestion: SuggestionRow;
  canMove: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const cardRef = useRef<HTMLLIElement>(null);
  return (
    <li
      ref={cardRef}
      className={cn(
        "flex items-stretch rounded-md border border-border bg-background transition-opacity",
        isDragging && "opacity-40",
      )}
    >
      {canMove && (
        <div
          role="button"
          aria-label={`Drag ${s.title} to another lane`}
          tabIndex={0}
          draggable
          onDragStart={(e) => {
            onDragStart();
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/suggestion-id", s.id);
            // Use the whole card as the drag image, not just the grip.
            if (cardRef.current) {
              const rect = cardRef.current.getBoundingClientRect();
              e.dataTransfer.setDragImage(
                cardRef.current,
                e.clientX - rect.left,
                e.clientY - rect.top,
              );
            }
          }}
          onDragEnd={onDragEnd}
          className="flex shrink-0 cursor-grab items-center px-1.5 text-muted-foreground/60 hover:bg-muted/40 hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical aria-hidden className="size-3.5" />
        </div>
      )}
      <Link
        href={`/suggestions/${s.id}`}
        className="block flex-1 p-3 hover:bg-muted/40"
      >
        <p className="text-sm font-medium text-foreground">{s.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {s.body}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          {s.team && <span>{s.team}</span>}
          {s.team && s.workflow_name && <span aria-hidden>·</span>}
          {s.workflow_id && s.workflow_name && (
            <span className="hover:text-foreground">{s.workflow_name}</span>
          )}
          {s.intervention_id && s.intervention_name && (
            <>
              <span aria-hidden>·</span>
              <span className="text-emerald-700">{s.intervention_name}</span>
            </>
          )}
        </div>
      </Link>
    </li>
  );
}
