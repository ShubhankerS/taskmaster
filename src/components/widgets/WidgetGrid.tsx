// FILE: ~/taskmaster/src/components/widgets/WidgetGrid.tsx
// Draggable, resizable widget grid using react-grid-layout.
// Layout is persisted in localStorage. Drag disabled on mobile (<768px).
// v3: Removed ProjectsWidget; Kanban is full-width, Notes + Analytics share bottom row.

"use client";

import { useState, useEffect, useCallback } from "react";
import { Responsive, WidthProvider } from "react-grid-layout";
import type { Layouts, Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import Widget from "./Widget";
import KanbanWidget from "./KanbanWidget";
import NotesWidget from "./NotesWidget";
import AnalyticsWidget from "./AnalyticsWidget";

const ResponsiveGridLayout = WidthProvider(Responsive);

const STORAGE_KEY = "taskmaster-widget-layout-v3";

// ─── Default layouts ──────────────────────────────────────────────────────────
// Grid: 12 cols on lg, 8 on md, 4 on sm/xs

const DEFAULT_LAYOUTS: Layouts = {
  lg: [
    { i: "kanban",    x: 0, y: 0,  w: 12, h: 10 },
    { i: "notes",     x: 0, y: 10, w: 6,  h: 5  },
    { i: "analytics", x: 6, y: 10, w: 6,  h: 5  },
  ],
  md: [
    { i: "kanban",    x: 0, y: 0,  w: 8,  h: 10 },
    { i: "notes",     x: 0, y: 10, w: 4,  h: 5  },
    { i: "analytics", x: 4, y: 10, w: 4,  h: 5  },
  ],
  sm: [
    { i: "kanban",    x: 0, y: 0,  w: 4,  h: 10 },
    { i: "notes",     x: 0, y: 10, w: 4,  h: 5  },
    { i: "analytics", x: 0, y: 15, w: 4,  h: 5  },
  ],
  xs: [
    { i: "kanban",    x: 0, y: 0,  w: 4,  h: 10 },
    { i: "notes",     x: 0, y: 10, w: 4,  h: 5  },
    { i: "analytics", x: 0, y: 15, w: 4,  h: 5  },
  ],
};

const WIDGET_TITLES: Record<string, string> = {
  kanban:    "Big Ideas Board",
  notes:     "Recent Notes",
  analytics: "Analytics",
};

function loadSavedLayouts(): Layouts | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Layouts;
  } catch {
    return null;
  }
}

function saveLayouts(layouts: Layouts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
  } catch {
    // ignore quota errors
  }
}

export default function WidgetGrid() {
  const [layouts, setLayouts] = useState<Layouts>(() => {
    return loadSavedLayouts() ?? DEFAULT_LAYOUTS;
  });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleLayoutChange = useCallback(
    (_currentLayout: Layout[], allLayouts: Layouts) => {
      setLayouts(allLayouts);
      saveLayouts(allLayouts);
    },
    []
  );

  function handleReset() {
    setLayouts(DEFAULT_LAYOUTS);
    saveLayouts(DEFAULT_LAYOUTS);
  }

  return (
    <div className="w-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-5 pb-1">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {isMobile ? "Widgets stacked for mobile" : "Drag widgets to rearrange"}
          </p>
        </div>
        {!isMobile && (
          <button
            onClick={handleReset}
            className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            Reset Layout
          </button>
        )}
      </div>

      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
        cols={{ lg: 12, md: 8, sm: 4, xs: 4 }}
        rowHeight={40}
        margin={[16, 16]}
        containerPadding={[24, 8]}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".widget-drag-handle"
        isDraggable={!isMobile}
        isResizable={!isMobile}
        resizeHandles={["se"]}
      >
        <div key="kanban">
          <Widget title={WIDGET_TITLES.kanban}>
            <KanbanWidget />
          </Widget>
        </div>

        <div key="notes">
          <Widget title={WIDGET_TITLES.notes}>
            <NotesWidget />
          </Widget>
        </div>

        <div key="analytics">
          <Widget title={WIDGET_TITLES.analytics}>
            <AnalyticsWidget />
          </Widget>
        </div>
      </ResponsiveGridLayout>
    </div>
  );
}
