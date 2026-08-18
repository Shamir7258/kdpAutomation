import { useState } from 'react';

/** Minimal native-HTML5-DnD reorder helper — no external drag-and-drop library needed for a flat list. */
export function useDragReorder<T>(items: T[], getId: (item: T) => string, onReorder: (newIds: string[]) => void) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  function onDragStart(id: string) {
    setDraggedId(id);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function onDrop(targetId: string) {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const ids = items.map(getId);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) {
      setDraggedId(null);
      return;
    }
    ids.splice(from, 1);
    ids.splice(to, 0, draggedId);
    onReorder(ids);
    setDraggedId(null);
  }

  return { onDragStart, onDragOver, onDrop, draggedId };
}
