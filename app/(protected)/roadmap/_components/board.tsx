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
import { EditRoadmapItemDialog } from "./edit-dialog";

type LaneKey = (typeof ROADMAP_STATUSES)[number];

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
    hint: "Prioritised build queue - top is next.",
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
 * One card model for both kinds. Suggestions and initiatives share lanes,
 * the queue, and drag behaviour; they differ only in link target and which
 * meta line renders. `dragId` ("suggestion:<id>" / "initiative:<id>") is
 * the identity everywhere: dnd-kit ids, React keys, and the reorder
 * action's payload.
 */
export type BoardCard = {
  dragId: string;
  kind: "suggestion" | "initiative";
  title: string;
  href: string;
  /** Suggestion pitch, absent on initiatives. */
  body?: string;
  meta: string[];
  /** Present on suggestion cards; powers the board's edit dialog. */
  editable?: { suggestionId: string; workflowIds: string[] };
};

type Groups = Record<LaneKey, BoardCard[]>;

/**
 * Trello-style four-column roadmap. A card's lane is derived from its row
 * (suggestions: status; initiatives: status + shipped_at + queue_rank), so
 * dropping a card is a small row update. The Queued lane is ordered by
 * queue_rank across both kinds, and dragging within it persists the new
 * priority via reorderQueue.
 *
 * Drag is super-admin only and runs on dnd-kit so it works with a pointer,
 * touch (PointerSensor), and the keyboard (KeyboardSensor: left/right
 * arrows jump between lanes; up/down inside the Queued lane step between
 * queue positions via the sortable coordinate getter). Announcements
 * narrate the move using the card's title. Drops apply optimistically
 * through useOptimistic so the card reaches its destination before the
 * server round-trip; if the server rejects, the optimistic state reverts
 * on revalidation and an inline error explains the snap-back.
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
  workflows,
}: {
  groups: Groups;
  canMove: boolean;
  /** Options for the edit dialog's workflow picker. */
  workflows: { id: string; name: string }[];
}) {
  const [, startTransition] = useTransition();
  const [moveError, setMoveError] = useState<string | null>(null);
  const [groups, applyOptimistic] = useOptimistic(
    serverGroups,
    (
      state: Groups,
      action:
        | { type: "move"; dragId: string; toLane: LaneKey }
        | { type: "reorder"; orderedDragIds: string[] },
    ) => {
      const next: Groups = {
        accepted: [...state.accepted],
        queued: [...state.queued],
        in_progress: [...state.in_progress],
        shipped: [...state.shipped],
      };
      if (action.type === "reorder") {
        const byDragId = new Map(next.queued.map((c) => [c.dragId, c]));
        next.queued = action.orderedDragIds
          .map((id) => byDragId.get(id))
          .filter((c): c is BoardCard => !!c);
        return next;
      }
      let card: BoardCard | undefined;
      for (const lane of LANES) {
        const idx = next[lane.key].findIndex((c) => c.dragId === action.dragId);
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

  // The keyboard getter needs to know whether the picked-up card is in the
  // queue. Closing over render state is safe here: useSensor re-reads its
  // options every render, and the sensor instantiates the getter at drag
  // start, so it always sees the queue as of pick-up (membership of the
  // active card can't change mid-drag).
  const queuedDragIds = new Set(groups.queued.map((c) => c.dragId));

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

  function laneOf(dragId: string): LaneKey | null {
    for (const lane of LANES) {
      if (groups[lane.key].some((c) => c.dragId === dragId)) return lane.key;
    }
    return null;
  }

  function describeOver(overId: string): string {
    if (LANE_KEYS.has(overId)) {
      return `the ${LANE_TITLE.get(overId) ?? overId} lane`;
    }
    const queueIndex = groups.queued.findIndex((c) => c.dragId === overId);
    if (queueIndex >= 0) {
      return `position ${queueIndex + 1} of ${groups.queued.length} in the Queued lane`;
    }
    const lane = laneOf(overId);
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

  function handleDragEnd(event: DragEndEvent) {
    setDragging(false);
    const { active, over } = event;
    if (!over || !canMove) return;
    const dragId = String(active.id);
    const kind = dragId.split(":")[0];
    if (kind !== "suggestion" && kind !== "initiative") return;

    // The drop target is either a lane or another card (queued cards are
    // sortable, so collisions often land on a card). Resolve cards to
    // their lane; remember the card so an in-queue drop knows its slot.
    const overStr = String(over.id);
    let targetLane: LaneKey | null = null;
    let overDragId: string | null = null;
    if (LANE_KEYS.has(overStr)) {
      targetLane = overStr as LaneKey;
    } else {
      targetLane = laneOf(overStr);
      overDragId = overStr;
    }
    if (!targetLane) return;

    const fromLane = laneOf(dragId);

    // Drop within the queue: persist the new priority order.
    if (fromLane === "queued" && targetLane === "queued") {
      const dragIds = groups.queued.map((c) => c.dragId);
      const from = dragIds.indexOf(dragId);
      const to = overDragId
        ? dragIds.indexOf(overDragId)
        : dragIds.length - 1; // dropped on lane whitespace: end of queue
      if (from === -1 || to === -1 || from === to) return;
      const next = arrayMove(dragIds, from, to);
      setMoveError(null);
      startTransition(async () => {
        applyOptimistic({ type: "reorder", orderedDragIds: next });
        const result = await reorderQueue(next);
        if (!result.ok) setMoveError(result.message);
      });
      return;
    }

    if (fromLane === targetLane) return;
    setMoveError(null);
    startTransition(async () => {
      applyOptimistic({ type: "move", dragId, toLane: targetLane as LaneKey });
      const fd = new FormData();
      fd.set("lane", targetLane as LaneKey);
      let result: { ok: true } | { ok: false; message: string };
      if (kind === "suggestion") {
        fd.set("suggestion_id", dragId.slice("suggestion:".length));
        result = await moveSuggestionLane(fd);
      } else {
        fd.set("initiative_id", dragId.slice("initiative:".length));
        result = await moveInitiativeLane(fd);
      }
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
          Move failed - the card snapped back. {moveError}
        </Alert>
      )}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {LANES.map((lane) => (
          <LaneColumn
            key={lane.key}
            lane={lane}
            canMove={canMove}
            dragging={dragging}
            cards={groups[lane.key]}
            workflows={workflows}
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
  cards,
  workflows,
}: {
  lane: Lane;
  canMove: boolean;
  dragging: boolean;
  cards: BoardCard[];
  workflows: { id: string; name: string }[];
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: lane.key,
    disabled: !canMove,
  });
  const isQueue = lane.key === "queued";

  const list = (
    <ul className="space-y-2">
      {cards.map((card, index) => (
        <CardItem
          key={card.dragId}
          card={card}
          canMove={canMove}
          sortable={isQueue}
          ordinal={isQueue ? index + 1 : undefined}
          workflows={workflows}
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
          <p className="mt-0.5 text-3xs leading-4 text-muted-foreground/80">
            {lane.hint}
          </p>
        </div>
        <span className="rounded-full border border-border bg-background px-1.5 py-px text-3xs tabular-nums text-muted-foreground">
          {cards.length}
        </span>
      </div>
      {cards.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-background px-3 py-6 text-center text-xs text-muted-foreground">
          {canMove ? "Drag cards here." : "Nothing here yet."}
        </p>
      ) : isQueue ? (
        <SortableContext
          items={cards.map((c) => c.dragId)}
          strategy={verticalListSortingStrategy}
        >
          {list}
        </SortableContext>
      ) : (
        list
      )}
    </div>
  );
}

/**
 * Card chrome shared by both wrappers: a dedicated grip handle column
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
          className="flex shrink-0 cursor-grab touch-none items-center rounded-l-md px-1.5 text-muted-foreground/60 outline-none hover:bg-muted/40 hover:text-foreground focus-visible:bg-muted/40 focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:inset-ring-2 focus-visible:inset-ring-primary active:cursor-grabbing"
        >
          <GripVertical aria-hidden className="size-3.5" />
        </button>
      )}
      {children}
    </li>
  );
}

/** Wrapper for cards in unordered lanes. */
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
 * Wrapper for Queued-lane cards: same chrome, but siblings shift out of
 * the way during a drag and dropping persists the queue order.
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

function CardItem({
  card,
  canMove,
  sortable,
  ordinal,
  workflows,
}: {
  card: BoardCard;
  canMove: boolean;
  sortable: boolean;
  ordinal?: number;
  workflows: { id: string; name: string }[];
}) {
  const Wrapper = sortable ? SortableCard : DraggableCard;
  return (
    <Wrapper dragId={card.dragId} title={card.title} canMove={canMove}>
      <Link
        href={card.href}
        className="block min-w-0 flex-1 p-3 transition-colors hover:bg-muted/40"
      >
        <p className="text-sm font-medium leading-snug text-foreground">
          {ordinal !== undefined && (
            <span className="mr-1.5 font-mono text-3xs tabular-nums text-muted-foreground/70">
              {ordinal}.
            </span>
          )}
          {card.title}
        </p>
        {card.body && (
          <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">
            {card.body}
          </p>
        )}
        {card.meta.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-3xs text-muted-foreground">
            {card.meta.map((m, i) => (
              <span key={m} className="inline-flex min-w-0 items-center gap-2">
                {i > 0 && <span aria-hidden>·</span>}
                <span className="truncate">{m}</span>
              </span>
            ))}
          </div>
        )}
      </Link>
      {canMove && card.editable && (
        <EditRoadmapItemDialog
          suggestionId={card.editable.suggestionId}
          title={card.title}
          body={card.body ?? ""}
          workflowIds={card.editable.workflowIds}
          workflows={workflows}
        />
      )}
    </Wrapper>
  );
}
