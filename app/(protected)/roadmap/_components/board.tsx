"use client";

import {
  useOptimistic,
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
} from "react";
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
  type CollisionDetection,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROADMAP_STATUSES } from "@/lib/roadmap";
import { Alert } from "@/components/ui/alert";
import {
  moveInitiativeLane,
  moveSuggestionLane,
  reorderQueue,
} from "../actions";

type LaneKey = (typeof ROADMAP_STATUSES)[number];
type InitiativeLaneKey = Exclude<LaneKey, "queued">;

type Lane = {
  key: LaneKey;
  title: string;
  hint: string;
};

// Lane names deliberately mirror the card status vocabulary so one state
// has one name everywhere. "Queued" is the prioritised build queue: cards
// are ordered (top = next up) and drag-to-reorder persists the priority.
const LANES: Lane[] = [
  {
    key: "accepted",
    title: "Accepted",
    hint: "Committed or on hold; not yet prioritised.",
  },
  {
    key: "queued",
    title: "Queued",
    hint: "Prioritised build queue — top is next.",
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

const LANE_KEYS = new Set<string>(LANES.map((l) => l.key));
const LANE_TITLE = new Map(LANES.map((l) => [l.key as string, l.title]));

/**
 * Lighter than the suggestions list's SuggestionRow: board cards don't show
 * votes or comment counts, so the page doesn't have to fetch them.
 */
export type RoadmapCard = {
  id: string;
  title: string;
  body: string;
  team: string | null;
  workflow_id: string | null;
  workflow_name: string | null;
  intervention_id: string | null;
  intervention_name: string | null;
};

type Groups = Record<LaneKey, RoadmapCard[]>;

export type RoadmapInitiative = {
  id: string;
  name: string;
  owner: string | null;
};

type InitiativeGroups = Record<InitiativeLaneKey, RoadmapInitiative[]>;

/**
 * Trello-style four-column roadmap. Lane membership is computed from the
 * suggestion's `status` (status alone decides the lane), so dropping a card
 * is a one-field update; the Queued lane is additionally ordered by
 * queue_rank, and dragging within it persists the new priority order via
 * reorderQueue.
 *
 * Drag is super-admin only and runs on dnd-kit so it works with a pointer,
 * touch (PointerSensor), and the keyboard (KeyboardSensor: left/right
 * arrows jump between lanes; up/down inside the Queued lane step between
 * queue positions via the sortable coordinate getter). Announcements
 * narrate the move using the card's title. Drops apply optimistically
 * through useOptimistic so the card reaches its destination before the
 * server round-trip; if the server rejects, the optimistic state reverts on
 * revalidation and an inline error explains the snap-back.
 *
 * AI initiatives also surface on the board (except in Queued — they have no
 * queue state). Lane membership is 2D over (shipped_at, status): shipped_at
 * set -> shipped (status stays active so dashboard metrics keep counting
 * it); otherwise paused -> accepted, active -> in_progress. Drag-write goes
 * through moveInitiativeLane.
 */

const SCREEN_READER_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    "To pick up a card, press space or enter on its drag handle. Use the left and right arrow keys to move it to another lane, the up and down arrow keys to change its position in the queue, press space or enter again to drop, or press escape to cancel.",
};

// Lane-jumping half of the keyboard coordinate getter: moves the dragged
// card between lane rects (instead of nudging by pixels), so a keyboard
// lane move is one arrow press per lane.
const laneCoordinateGetter: KeyboardCoordinateGetter = (
  event,
  { context: { droppableRects, collisionRect } },
) => {
  const moves: Record<string, 1 | -1> = {
    ArrowRight: 1,
    ArrowLeft: -1,
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

// Queued cards are droppables in their own right (that's what makes them
// sortable), but a dragged card always overlaps its containing lane far
// more than any sibling card - plain rectIntersection would report the
// lane every time and every in-queue drop would fall to "end of queue".
// So: check card droppables first, and only fall back to lanes when no
// card is under the drag.
const cardsThenLanes: CollisionDetection = (args) => {
  const cardHits = rectIntersection({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (c) => !LANE_KEYS.has(String(c.id)),
    ),
  });
  if (cardHits.length > 0) return cardHits;
  return rectIntersection({
    ...args,
    droppableContainers: args.droppableContainers.filter((c) =>
      LANE_KEYS.has(String(c.id)),
    ),
  });
};

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
    (
      state: Groups,
      action:
        | { type: "move"; id: string; toLane: LaneKey }
        | { type: "reorder"; orderedIds: string[] },
    ) => {
      const next: Groups = {
        accepted: [...state.accepted],
        queued: [...state.queued],
        in_progress: [...state.in_progress],
        shipped: [...state.shipped],
      };
      if (action.type === "reorder") {
        const byId = new Map(next.queued.map((s) => [s.id, s]));
        next.queued = action.orderedIds
          .map((id) => byId.get(id))
          .filter((s): s is RoadmapCard => !!s);
        return next;
      }
      let card: RoadmapCard | undefined;
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
    accepted: [],
    in_progress: [],
    shipped: [],
  };
  const [initiativeGroups, applyOptimisticInitiative] = useOptimistic(
    serverInitiativeGroups ?? emptyInitiativeGroups,
    (
      state: InitiativeGroups,
      action: { id: string; toLane: InitiativeLaneKey },
    ) => {
      const next: InitiativeGroups = {
        accepted: [...state.accepted],
        in_progress: [...state.in_progress],
        shipped: [...state.shipped],
      };
      let card: RoadmapInitiative | undefined;
      for (const key of Object.keys(next) as InitiativeLaneKey[]) {
        const idx = next[key].findIndex((i) => i.id === action.id);
        if (idx >= 0) {
          card = next[key][idx];
          next[key].splice(idx, 1);
          break;
        }
      }
      if (card) next[action.toLane] = [card, ...next[action.toLane]];
      return next;
    },
  );

  // The keyboard getter needs to know whether the picked-up card is in the
  // queue. Closing over render state is safe here: useSensor re-reads its
  // options every render, and the sensor instantiates the getter at drag
  // start, so it always sees the queue as of pick-up (membership of the
  // active card can't change mid-drag).
  const queuedDragIds = new Set(groups.queued.map((s) => `suggestion:${s.id}`));

  const coordinateGetter: KeyboardCoordinateGetter = (event, args) => {
    const inQueue = queuedDragIds.has(String(args.active));
    if (inQueue && (event.code === "ArrowUp" || event.code === "ArrowDown")) {
      return sortableKeyboardCoordinates(event, args);
    }
    return laneCoordinateGetter(event, args);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter }),
  );

  function describeOver(overId: string): string {
    if (LANE_KEYS.has(overId)) {
      return `the ${LANE_TITLE.get(overId) ?? overId} lane`;
    }
    const [kind, id] = overId.split(":");
    if (kind === "suggestion") {
      const queueIndex = groups.queued.findIndex((s) => s.id === id);
      if (queueIndex >= 0) {
        return `position ${queueIndex + 1} of ${groups.queued.length} in the Queued lane`;
      }
    }
    const lane = laneOf(id, kind === "initiative" ? "initiative" : "suggestion");
    return lane ? `the ${LANE_TITLE.get(lane) ?? lane} lane` : "a lane";
  }

  const announcements: Announcements = {
    onDragStart({ active }) {
      return `Picked up ${activeTitle(active)}.`;
    },
    onDragOver({ active, over }) {
      if (!over) return `${activeTitle(active)} is no longer over a lane.`;
      return `${activeTitle(active)} is over ${describeOver(String(over.id))}.`;
    },
    onDragEnd({ active, over }) {
      if (!over) return `${activeTitle(active)} was dropped.`;
      return `${activeTitle(active)} was dropped into ${describeOver(String(over.id))}.`;
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
          : lane.key !== "queued" &&
            initiativeGroups[lane.key].some((i) => i.id === id);
      if (found) return lane.key;
    }
    return null;
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragging(false);
    const { active, over } = event;
    if (!over || !canMove) return;
    const [kind, id] = String(active.id).split(":");
    if (kind !== "suggestion" && kind !== "initiative") return;

    // The drop target is either a lane or another card (queued cards are
    // sortable, so rectIntersection often lands on a card). Resolve cards
    // to their lane; remember the card so an in-queue drop knows its slot.
    const overStr = String(over.id);
    let targetLane: LaneKey | null = null;
    let overSuggestionId: string | null = null;
    if (LANE_KEYS.has(overStr)) {
      targetLane = overStr as LaneKey;
    } else {
      const [overKind, overId] = overStr.split(":");
      if (overKind !== "suggestion" && overKind !== "initiative") return;
      targetLane = laneOf(overId, overKind);
      if (overKind === "suggestion") overSuggestionId = overId;
    }
    if (!targetLane) return;

    const fromLane = laneOf(id, kind);

    if (kind === "initiative") {
      if (targetLane === "queued") {
        setMoveError(
          "Initiatives can't be queued — only suggestions carry a queue priority. Drop it in Accepted or In progress instead.",
        );
        return;
      }
      if (fromLane === targetLane) return;
      setMoveError(null);
      startTransition(async () => {
        applyOptimisticInitiative({
          id,
          toLane: targetLane as InitiativeLaneKey,
        });
        const fd = new FormData();
        fd.set("initiative_id", id);
        fd.set("lane", targetLane);
        const result = await moveInitiativeLane(fd);
        if (!result.ok) setMoveError(result.message);
      });
      return;
    }

    // Suggestion dropped within the queue: persist the new priority order.
    if (fromLane === "queued" && targetLane === "queued") {
      const ids = groups.queued.map((s) => s.id);
      const from = ids.indexOf(id);
      const to = overSuggestionId
        ? ids.indexOf(overSuggestionId)
        : ids.length - 1; // dropped on lane whitespace -> end of queue
      if (from === -1 || to === -1 || from === to) return;
      const next = arrayMove(ids, from, to);
      setMoveError(null);
      startTransition(async () => {
        applyOptimistic({ type: "reorder", orderedIds: next });
        const result = await reorderQueue(next);
        if (!result.ok) setMoveError(result.message);
      });
      return;
    }

    if (fromLane === targetLane) return;
    setMoveError(null);
    startTransition(async () => {
      applyOptimistic({ type: "move", id, toLane: targetLane as LaneKey });
      const fd = new FormData();
      fd.set("suggestion_id", id);
      fd.set("lane", targetLane as LaneKey);
      const result = await moveSuggestionLane(fd);
      if (!result.ok) setMoveError(result.message);
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={cardsThenLanes}
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
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {LANES.map((lane) => (
          <LaneColumn
            key={lane.key}
            lane={lane}
            canMove={canMove}
            dragging={dragging}
            suggestions={groups[lane.key]}
            initiatives={
              lane.key === "queued" ? [] : initiativeGroups[lane.key]
            }
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
  suggestions: RoadmapCard[];
  initiatives: RoadmapInitiative[];
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: lane.key,
    disabled: !canMove,
  });
  const totalCount = suggestions.length + initiatives.length;
  const isQueue = lane.key === "queued";

  const cards = (
    <ul className="space-y-2">
      {initiatives.map((iv) => (
        <InitiativeCardItem
          key={`initiative:${iv.id}`}
          initiative={iv}
          canMove={canMove}
        />
      ))}
      {suggestions.map((s, index) => (
        <SuggestionCardItem
          key={s.id}
          suggestion={s}
          canMove={canMove}
          sortable={isQueue}
          ordinal={isQueue ? index + 1 : undefined}
        />
      ))}
    </ul>
  );

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
      <div className="mb-3 flex items-start justify-between gap-2 px-1">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            {lane.title}
          </h3>
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground/80">
            {lane.hint}
          </p>
        </div>
        <span className="rounded-full border border-border bg-background px-1.5 py-px text-[11px] tabular-nums text-muted-foreground">
          {totalCount}
        </span>
      </div>
      {totalCount === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-background px-3 py-6 text-center text-xs text-muted-foreground">
          {canMove ? "Drag cards here." : "Nothing here yet."}
        </p>
      ) : isQueue ? (
        <SortableContext
          items={suggestions.map((s) => `suggestion:${s.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {cards}
        </SortableContext>
      ) : (
        cards
      )}
    </div>
  );
}

/**
 * Card chrome shared by both card types: a dedicated grip handle column
 * (the dnd-kit activator) next to a Link body, so the body's Link is never
 * the drag source. Pattern mirrors Linear / Asana / Trello boards.
 */
function CardShell({
  setNodeRef,
  setActivatorNodeRef,
  style,
  isDragging,
  handleProps,
  title,
  canMove,
  children,
}: {
  setNodeRef: (node: HTMLElement | null) => void;
  setActivatorNodeRef: (node: HTMLElement | null) => void;
  style: CSSProperties;
  isDragging: boolean;
  handleProps: Record<string, unknown>;
  title: string;
  canMove: boolean;
  children: ReactNode;
}) {
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-stretch overflow-hidden rounded-md border border-border bg-background shadow-xs",
        isDragging && "relative z-10 opacity-80 shadow-md",
      )}
    >
      {canMove && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...handleProps}
          aria-label={`Move ${title} to another lane or queue position`}
          className="flex shrink-0 cursor-grab touch-none items-center rounded-l-md px-1.5 text-muted-foreground/60 outline-none hover:bg-muted/40 hover:text-foreground focus-visible:bg-muted/40 focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
        >
          <GripVertical aria-hidden className="size-3.5" />
        </button>
      )}
      {children}
    </li>
  );
}

/** Plain draggable wrapper for cards in unordered lanes. */
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
    <CardShell
      setNodeRef={setNodeRef}
      setActivatorNodeRef={setActivatorNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      isDragging={isDragging}
      handleProps={{ ...attributes, ...listeners }}
      title={title}
      canMove={canMove}
    >
      {children}
    </CardShell>
  );
}

/**
 * Sortable wrapper for Queued-lane cards: same chrome, but siblings shift
 * out of the way during a drag and dropping persists the queue order.
 */
function SortableCard({
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
    transition,
    isDragging,
  } = useSortable({
    id: dragId,
    data: { title },
    disabled: !canMove,
  });

  return (
    <CardShell
      setNodeRef={setNodeRef}
      setActivatorNodeRef={setActivatorNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      isDragging={isDragging}
      handleProps={{ ...attributes, ...listeners }}
      title={title}
      canMove={canMove}
    >
      {children}
    </CardShell>
  );
}

function SuggestionCardItem({
  suggestion: s,
  canMove,
  sortable,
  ordinal,
}: {
  suggestion: RoadmapCard;
  canMove: boolean;
  sortable: boolean;
  ordinal?: number;
}) {
  const Wrapper = sortable ? SortableCard : DraggableCard;
  return (
    <Wrapper dragId={`suggestion:${s.id}`} title={s.title} canMove={canMove}>
      <Link
        href={`/suggestions/${s.id}`}
        className="block min-w-0 flex-1 p-3 transition-colors hover:bg-muted/40"
      >
        <p className="text-sm font-medium leading-snug text-foreground">
          {ordinal !== undefined && (
            <span className="mr-1.5 font-mono text-[11px] tabular-nums text-muted-foreground/70">
              {ordinal}.
            </span>
          )}
          {s.title}
        </p>
        <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">
          {s.body}
        </p>
        {(s.team || (s.workflow_id && s.workflow_name) || (s.intervention_id && s.intervention_name)) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            {s.team && <span>{s.team}</span>}
            {s.team && s.workflow_name && <span aria-hidden>·</span>}
            {s.workflow_id && s.workflow_name && (
              <span className="truncate">{s.workflow_name}</span>
            )}
            {s.intervention_id && s.intervention_name && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{s.intervention_name}</span>
              </>
            )}
          </div>
        )}
      </Link>
    </Wrapper>
  );
}

/**
 * Initiative card: same chrome as a suggestion card, linking to the AI
 * initiative detail page. No type badge - on the board an item is an item;
 * the detail page it opens says what it is.
 */
function InitiativeCardItem({
  initiative: iv,
  canMove,
}: {
  initiative: RoadmapInitiative;
  canMove: boolean;
}) {
  return (
    <DraggableCard
      dragId={`initiative:${iv.id}`}
      title={iv.name}
      canMove={canMove}
    >
      <Link
        href={`/interventions/${iv.id}`}
        className="block min-w-0 flex-1 p-3 transition-colors hover:bg-muted/40"
      >
        <p className="truncate text-sm font-medium leading-snug text-foreground">
          {iv.name}
        </p>
        {iv.owner && (
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {iv.owner}
          </p>
        )}
      </Link>
    </DraggableCard>
  );
}
