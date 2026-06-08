"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
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
import { reorderVideos } from "../actions";

export type SortableItem = { id: string; node: ReactNode };

const GRID_CLASS = "grid gap-6 sm:grid-cols-2 lg:grid-cols-3";

export function SortableVideoGrid({
  items,
  canManage,
}: {
  items: SortableItem[];
  canManage: boolean;
}) {
  // Non-admins (and the common case) get the exact static grid as before —
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

function SortableGrid({ items }: { items: SortableItem[] }) {
  const serverIds = items.map((it) => it.id);
  const serverKey = serverIds.join("|");
  const [order, setOrder] = useState(serverIds);
  const [syncedKey, setSyncedKey] = useState(serverKey);
  const [, startTransition] = useTransition();

  // Resync when the server sends a new set/order of videos (after a
  // revalidate, an add, or a delete). Adjusting state during render — keyed
  // on the id list — is React's recommended alternative to a sync effect,
  // and means an optimistic reorder we've already applied (same ids, new
  // order persisted server-side) reconciles without a flicker.
  if (serverKey !== syncedKey) {
    setSyncedKey(serverKey);
    setOrder(serverIds);
  }

  const nodeById = new Map(items.map((it) => [it.id, it.node]));

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
    const next = arrayMove(order, from, to);
    setOrder(next); // optimistic
    startTransition(() => {
      void reorderVideos(next);
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <div className={GRID_CLASS}>
          {order.map((id) => {
            const node = nodeById.get(id);
            if (!node) return null;
            return (
              <SortableCard key={id} id={id}>
                {node}
              </SortableCard>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableCard({ id, children }: { id: string; children: ReactNode }) {
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
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="absolute left-2 top-2 z-20 inline-flex size-7 cursor-grab touch-none items-center justify-center rounded-md bg-foreground/70 text-background opacity-0 transition-opacity hover:bg-foreground focus-visible:opacity-100 active:cursor-grabbing group-hover/card:opacity-100"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      {children}
    </div>
  );
}
