// FILE: ~/taskmaster/src/components/widgets/KanbanWidget.tsx
// Widget wrapper for the Kanban board — just renders KanbanBoard with overflow scroll.

"use client";

import KanbanBoard from "@/components/KanbanBoard";

export default function KanbanWidget() {
  return (
    <div className="p-4 h-full overflow-auto flex flex-col">
      <div className="flex-1 min-h-0">
        <KanbanBoard />
      </div>
    </div>
  );
}
