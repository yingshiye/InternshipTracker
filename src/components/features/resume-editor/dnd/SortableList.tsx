"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";

/**
 * A vertical sortable list. `ids` is the current order; `onReorder` receives
 * the full new order after a drag. Keyboard drag is enabled via KeyboardSensor
 * (space/enter to lift, arrows to move) — but every item also renders explicit
 * Move buttons as the guaranteed-accessible path.
 *
 * `id` must be a value that is identical on the server render and the first
 * client render (a resume/section/entry id from loaded data works; an
 * incrementing counter or anything client-only does not). Without it,
 * dnd-kit falls back to a module-level counter for its screen-reader-only
 * `aria-describedby` id, and that counter's value depends on how many
 * DndContext instances have mounted before this one in the current process —
 * which differs between the server render and the client render whenever
 * more than one list is on the page, producing a hydration mismatch on every
 * load even though nothing is actually wrong with the dragged content.
 */
export function SortableList({
  id,
  ids,
  onReorder,
  children,
}: {
  id: string;
  ids: string[];
  onReorder: (orderedIds: string[]) => void;
  children: React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const next = [...ids];
    next.splice(newIndex, 0, next.splice(oldIndex, 1)[0]);
    onReorder(next);
  }

  return (
    <DndContext id={id} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}
