"use client";

import { useOptimistic, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, RocketIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { moveInitiativeLane, moveSuggestionLane } from "../actions";
import type { SuggestionRow } from "./suggestion-card";

type LaneKey = "up_next" | "in_progress" | "shipped";

type Lane = {
  key: LaneKey;
  title: string;
  hint: string;
};

// Lane names deliberately mirror the card status vocabulary ("Accepted",
// "In progress", "Shipped") so one state has one name everywhere.
const LANES: Lane[] = [
  {
    key: "up_next",
    title: "Accepted",
    hint: "Committed or on hold; not started yet.",
  },
  {
    key: "in_progress",
    title: "In progress",
    hint: "Currently underway.",
  },
  {
    key: "shipped",
    title: "Shipped",
    hint: "Live and done; still counted in active metrics.",
  },
];

const LANE_TITLE = new Map(LANES.map((l) => [l.key as string, l.title]));

type Groups = Record<LaneKey, SuggestionRow[]>;

export type RoadmapInitiative = {
  id: string;
  name: string;
  owner: string | null;
};

type InitiativeGroups = Record<LaneKey, RoadmapInitiative[]>;

/**
 * Trello-style three-column roadmap. Lane membership is computed from the
 * suggestion's `status` (after the in_progress migration: status alone
 * decides the lane), so dropping a card is a one-field update.
 *
 * Drag is super-admin only and runs on dnd-kit so it works with a pointer,
 * touch (PointerSensor), and the keyboard (KeyboardSensor with a lane-
 * jumping coordinate getter: pick up with space/enter on the grip, arrows
 * move between lanes, space/enter drops). Announcements narrate the move
 * using the card's title. The drop handler runs optimistically through
 * useOptimistic so the card reaches its destination before the server
 * round-trip; if the server rejects, the optimistic state reverts on
 * revalidation and an inline error explains the snap-back.
 *
 * AI initiatives also surface on the board. Lane membership is 2D over
 * (shipped_at, status): shipped_at set -> shipped (status stays active so
 * dashboard metrics keep counting it); otherwise paused -> up_next, active
 * -> in_progress. Drag-write goes through moveInitiativeLane.
 */

const SCREEN_READER_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    "To pick up a card, press space or enter on its drag handle. Use the arrow keys to move it to another lane, press space or enter again to drop, or press escape to cancel.",
};

// Keyboard coordinate getter that jumps the dragged card between lane
// rects (instead of nudging by pixels), so a keyboard move is one arrow
// press per lane in either layout direction (columns on desktop, stacked
// on mobile).
const laneCoordinateGetter: KeyboardCoordinateGetter = (
  event,
  { context: { droppableRects, collisionRect } },
) => {
  const moves: Record<string, 1 | -1> = {
    ArrowRight: 1,
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowUp: -1,
  };
  const delta = moves[event.code];
  if (!delta || !collisionRect) return;
  event.preventDefault();

  const laneRects = LANES.flatMap((l) => {
    const rect = droppableRects.get(l.key);
    return rect ? [{ key: l.key, rect }] : [];
  });
  if (laneRects.length === 0) return;

  const centerX = collisionRect.left + collisionRect.width / 2;
  const centerY = collisionRect.top + collisionRect.height / 2;
  let currentIndex = laneRects.findIndex(
    ({ rect }) =>
      centerX >= rect.left &&
      centerX <= rect.left + rect.width &&
      centerY >= rect.top &&
      centerY <= rect.top + rect.height,
  );
  if (currentIndex === -1) currentIndex = delta > 0 ? -1 : laneRects.length;

  const nextIndex = Math.min(
    laneRects.length - 1,
    Math.max(0, currentIndex + delta),
  );
  if (nextIndex === currentIndex) return;
  const next = laneRects[nextIndex].rect;
  return {
    x: next.left + next.width / 2 - collisionRect.width / 2,
    y: next.top + 24,
  };
};

function activeTitle(active: { data: { current?: unknown } }): string {
  const data = active.data.current as { title?: string } | undefined;
  return data?.title ?? "card";
}

export function RoadmapBoard({
  groups: serverGroups,
  canMove,
  initiativeGroups: serverInitiativeGroups,
}: {
  groups: Groups;
  canMove: boolean;
  initiativeGroups?: InitiativeGroups;
}) {
  const [, startTransition] = useTransition();
  const [moveError, setMoveError] = useState<string | null>(null);
  const [groups, applyOptimistic] = useOptimistic(
    serverGroups,
    (state: Groups, action: { id: string; toLane: LaneKey }) => {
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

  const emptyInitiativeGroups: InitiativeGroups = {
    up_next: [],
    in_progress: [],
    shipped: [],
  };
  const [initiativeGroups, applyOptimisticInitiative] = useOptimistic(
    serverInitiativeGroups ?? emptyInitiativeGroups,
    (state: InitiativeGroups, action: { id: string; toLane: LaneKey }) => {
      const next: InitiativeGroups = {
        up_next: [...state.up_next],
        in_progress: [...state.in_progress],
        shipped: [...state.shipped],
      };
      let card: RoadmapInitiative | undefined;
      for (const lane of LANES) {
        const idx = next[lane.key].findIndex((i) => i.id === action.id);
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: laneCoordinateGetter }),
  );

  const announcements: Announcements = {
    onDragStart({ active }) {
      return `Picked up ${activeTitle(active)}.`;
    },
    onDragOver({ active, over }) {
      if (!over) return `${activeTitle(active)} is no longer over a lane.`;
      return `${activeTitle(active)} is over the ${LANE_TITLE.get(String(over.id)) ?? over.id} lane.`;
    },
    onDragEnd({ active, over }) {
      if (!over) return `${activeTitle(active)} was dropped.`;
      return `${activeTitle(active)} was dropped into the ${LANE_TITLE.get(String(over.id)) ?? over.id} lane.`;
    },
    onDragCancel({ active }) {
      return `Move cancelled. ${activeTitle(active)} returned to its lane.`;
    },
  };

  const [dragging, setDragging] = useState(false);

  function laneOf(id: string, kind: "suggestion" | "initiative"): LaneKey | null {
    for (const lane of LANES) {
      const found =
        kind === "suggestion"
          ? groups[lane.key].some((s) => s.id === id)
          : initiativeGroups[lane.key].some((i) => i.id === id);
      if (found) return lane.key;
    }
    return null;
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragging(false);
    const { active, over } = event;
    if (!over || !canMove) return;
    const targetLane = over.id as LaneKey;
    const [kind, id] = String(active.id).split(":");
    if (kind !== "suggestion" && kind !== "initiative") return;
    if (laneOf(id, kind) === targetLane) return; // no-op drop

    setMoveError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("lane", targetLane);
      let result: { ok: true } | { ok: false; message: string };
      if (kind === "suggestion") {
        applyOptimistic({ id, toLane: targetLane });
        fd.set("suggestion_id", id);
        result = await moveSuggestionLane(fd);
      } else {
        applyOptimisticInitiative({ id, toLane: targetLane });
        fd.set("initiative_id", id);
        result = await moveInitiativeLane(fd);
      }
      if (!result.ok) setMoveError(result.message);
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={() => setDragging(true)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragging(false)}
      accessibility={{
        announcements,
        screenReaderInstructions: SCREEN_READER_INSTRUCTIONS,
      }}
    >
      {moveError && (
        <Alert variant="destructive" className="mb-3">
          Move failed — the card snapped back. {moveError}
        </Alert>
      )}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {LANES.map((lane) => (
          <LaneColumn
            key={lane.key}
            lane={lane}
            canMove={canMove}
            dragging={dragging}
            suggestions={groups[lane.key]}
            initiatives={initiativeGroups[lane.key]}
          />
        ))}
      </section>
    </DndContext>
  );
}

function LaneColumn({
  lane,
  canMove,
  dragging,
  suggestions,
  initiatives,
}: {
  lane: Lane;
  canMove: boolean;
  dragging: boolean;
  suggestions: SuggestionRow[];
  initiatives: RoadmapInitiative[];
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: lane.key,
    disabled: !canMove,
  });
  const totalCount = suggestions.length + initiatives.length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border p-3 transition-colors",
        isOver && dragging
          ? "border-input bg-muted"
          : "border-border bg-muted/40",
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
          {canMove ? "Drag cards here." : "Nothing here yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {initiatives.map((iv) => (
            <InitiativeCardItem
              key={`initiative:${iv.id}`}
              initiative={iv}
              canMove={canMove}
            />
          ))}
          {suggestions.map((s) => (
            <SuggestionCardItem key={s.id} suggestion={s} canMove={canMove} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Card chrome shared by both card types: a dedicated grip handle column
 * (the dnd-kit activator) next to a Link body, so the body's Link is never
 * the drag source. Pattern mirrors Linear / Asana / Trello boards.
 */
function DraggableCard({
  dragId,
  title,
  canMove,
  children,
}: {
  dragId: string;
  title: string;
  canMove: boolean;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: dragId,
    data: { title },
    disabled: !canMove,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "flex items-stretch rounded-md border border-border bg-background",
        isDragging && "relative z-10 opacity-80 shadow-md",
      )}
    >
      {canMove && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Move ${title} to another lane`}
          className="flex shrink-0 cursor-grab touch-none items-center rounded-l-md px-1.5 text-muted-foreground/60 outline-none hover:bg-muted/40 hover:text-foreground focus-visible:bg-muted/40 focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
        >
          <GripVertical aria-hidden className="size-3.5" />
        </button>
      )}
      {children}
    </li>
  );
}

function SuggestionCardItem({
  suggestion: s,
  canMove,
}: {
  suggestion: SuggestionRow;
  canMove: boolean;
}) {
  return (
    <DraggableCard dragId={`suggestion:${s.id}`} title={s.title} canMove={canMove}>
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
              <span>{s.intervention_name}</span>
            </>
          )}
        </div>
      </Link>
    </DraggableCard>
  );
}

/**
 * Initiative card: same shape as a suggestion card but the link target is
 * an AI initiative detail page, and a neutral outline "Initiative" badge
 * marks the card type (a colour-coded dot would falsely read as a status).
 */
function InitiativeCardItem({
  initiative: iv,
  canMove,
}: {
  initiative: RoadmapInitiative;
  canMove: boolean;
}) {
  return (
    <DraggableCard dragId={`initiative:${iv.id}`} title={iv.name} canMove={canMove}>
      <Link
        href={`/interventions/${iv.id}`}
        className="block min-w-0 flex-1 p-3 hover:bg-muted/40"
      >
        <p className="truncate text-sm font-medium text-foreground">
          {iv.name}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <Badge variant="outline">
            <RocketIcon aria-hidden />
            Initiative
          </Badge>
          {iv.owner && <span className="truncate">{iv.owner}</span>}
        </div>
      </Link>
    </DraggableCard>
  );
}
