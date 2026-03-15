// FILE: ~/taskmaster/src/components/widgets/Widget.tsx
// Wrapper component for each widget — header, drag handle, minimize button.

"use client";

import { useState } from "react";

interface WidgetProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  /** Injected by react-grid-layout via the drag handle class */
  dragHandleClass?: string;
}

export default function Widget({
  title,
  children,
  className = "",
  dragHandleClass = "widget-drag-handle",
}: WidgetProps) {
  const [minimized, setMinimized] = useState(false);

  return (
    <div
      className={`bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden h-full flex flex-col ${className}`}
    >
      {/* Widget header */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0 ${dragHandleClass}`}
        style={{ cursor: "grab" }}
      >
        <div className="flex items-center gap-2">
          {/* Drag handle */}
          <span
            className="text-gray-600 select-none flex-shrink-0 text-sm leading-none"
            title="Drag to move"
          >
            ⠿
          </span>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
        </div>
        <button
          onClick={() => setMinimized((m) => !m)}
          className="text-gray-500 hover:text-gray-300 p-0.5 rounded transition-colors text-sm leading-none"
          title={minimized ? "Expand" : "Minimize"}
        >
          {minimized ? "▲" : "×"}
        </button>
      </div>

      {/* Widget content */}
      {!minimized && (
        <div className="flex-1 overflow-hidden min-h-0">{children}</div>
      )}
    </div>
  );
}
