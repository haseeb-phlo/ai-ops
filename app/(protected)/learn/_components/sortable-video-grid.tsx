"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { reorderVideos } from "../actions";

export type SortableItem = { id: string; title: string; node: ReactNode };

const GRID_CLASS = "grid gap-6 sm:grid-cols-2 lg:grid-cols-3";

export function SortableVideoGrid({
  items,
  canManage,
}: {
  items: SortableItem[];
  canManage: boolean;
}) {
  // Non-admins (and the common case) get the exact static grid as before -
  // no DnD machinery mounted at all.
  if (!canManage) {
    return (
      <div className={GRID_CLASS}>
        {items.map((it) => (
          <div key={it.id} className="h-full">
            {it.node}
          </div>
        ))}
      </div>
    );
  }
  return <SortableGrid items={items} />;
}

const SCREEN_READER_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    "To pick up a video, press space or enter on its drag handle. Use the arrow keys to move it to a new position within the topic, press space or enter again to drop, or press escape to cancel.",
};

function SortableGrid({ items }: { items: SortableItem[] }) {
  const serverIds = items.map((it) => it.id);
  const serverKey = serverIds.join("|");
  const [order, setOrder] = useState(serverIds);
  const [syncedKey, setSyncedKey] = useState(serverKey);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Resync when the server sends a new set/order of videos (after a
  // revalidate, an add, or a delete). Adjusting state during render - keyed
  // on the id list - is React's recommended alternative to a sync effect,
  // and means an optimistic reorder we've already applied (same ids, new
  // order persisted server-side) reconciles without a flicker.
  if (serverKey !== syncedKey) {
    setSyncedKey(serverKey);
    setOrder(serverIds);
  }

  const nodeById = new Map(items.map((it) => [it.id, it.node]));
  const titleById = new Map(items.map((it) => [it.id, it.title]));
  const titleFor = (id: unknown) => titleById.get(String(id)) ?? "video";

  const announcements: Announcements = {
    onDragStart({ active }) {
      return `Picked up ${titleFor(active.id)}.`;
    },
    onDragOver({ active, over }) {
      if (!over) return undefined;
      const position = order.indexOf(String(over.id)) + 1;
      return `${titleFor(active.id)} was moved to position ${position} of ${order.length}.`;
    },
    onDragEnd({ active, over }) {
      if (!over) return `${titleFor(active.id)} was dropped.`;
      const position = order.indexOf(String(over.id)) + 1;
      return `${titleFor(active.id)} was dropped at position ${position} of ${order.length}.`;
    },
    onDragCancel({ active }) {
      return `Reordering cancelled. ${titleFor(active.id)} returned to its original position.`;
    },
  };

  const sensors = useSensors(
    // A small drag threshold so taps on the card's buttons (play, edit,
    // reactions, comments) still register as clicks, not drags.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    const previous = order;
    const next = arrayMove(order, from, to);
    setOrder(next); // optimistic
    setError(null);
    startTransition(async () => {
      const result = await reorderVideos(next);
      if (result.kind === "error") {
        // Revert the optimistic order and explain the snap-back.
        setOrder(previous);
        setError(result.message);
      }
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: SCREEN_READER_INSTRUCTIONS,
      }}
    >
      {error && (
        <Alert variant="destructive" className="mb-3">
          {error}
        </Alert>
      )}
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <div className={GRID_CLASS}>
          {order.map((id) => {
            const node = nodeById.get(id);
            if (!node) return null;
            return (
              <SortableCard key={id} id={id} title={titleFor(id)}>
                {node}
              </SortableCard>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableCard({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
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
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group/card relative h-full ${isDragging ? "z-10 opacity-60" : ""}`}
    >
      {/* Visible at rest (muted) so the affordance is discoverable; full
          strength on hover/focus. */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${title}`}
        className="absolute left-2 top-2 z-20 inline-flex size-7 cursor-grab touch-none items-center justify-center rounded-md bg-foreground/50 text-background transition-colors hover:bg-foreground focus-visible:bg-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:inset-ring-2 focus-visible:inset-ring-primary active:cursor-grabbing"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      {children}
    </div>
  );
}
