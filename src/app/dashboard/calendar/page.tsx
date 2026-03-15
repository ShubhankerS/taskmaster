// FILE: ~/taskmaster/src/app/dashboard/calendar/page.tsx
// Calendar view showing tasks with due dates as events.
// Uses react-big-calendar with date-fns as the localizer.

"use client";

import { useEffect, useCallback, useState } from "react";
import axios from "axios";
import { Calendar, dateFnsLocalizer, type View } from "react-big-calendar";
import {
  format,
  parse,
  startOfWeek,
  getDay,
} from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useTaskmasterStore, type Task, type TaskPriority } from "@/lib/store";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { "en-US": enUS },
});

// Priority → background color
const PRIORITY_BG: Record<TaskPriority, string> = {
  HIGH: "#7f1d1d",
  MEDIUM: "#78350f",
  LOW: "#1e3a5f",
};

const PRIORITY_BORDER: Record<TaskPriority, string> = {
  HIGH: "#ef4444",
  MEDIUM: "#f59e0b",
  LOW: "#3b82f6",
};

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Task;
}

interface EditModal {
  task: Task;
}

export default function CalendarPage() {
  const { tasks, setTasks, tasksLoading, setTasksLoading } =
    useTaskmasterStore();
  const [hasFetched, setHasFetched] = useState(false);
  const [editModal, setEditModal] = useState<EditModal | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<View>("month");

  const fetchTasks = useCallback(async () => {
    try {
      const { data } = await axios.get<{ tasks: Task[] }>("/api/tasks");
      setTasks(data.tasks ?? data);
    } catch {
      // ignore
    }
  }, [setTasks]);

  useEffect(() => {
    if (!hasFetched) {
      setTasksLoading(true);
      fetchTasks().finally(() => {
        setTasksLoading(false);
        setHasFetched(true);
      });
    }
    const es = new EventSource("/api/events");
    es.addEventListener("ping", () => fetchTasks());
    es.onerror = () => es.close();
    return () => es.close();
  }, [fetchTasks, setTasksLoading, hasFetched]);

  // Build calendar events from tasks that have a due date
  const events: CalendarEvent[] = tasks
    .filter((t) => t.dueDate)
    .map((t) => {
      const due = new Date(t.dueDate!);
      return {
        id: t.id,
        title: t.title,
        start: due,
        end: due,
        resource: t,
      };
    });

  function eventStyleGetter(event: CalendarEvent) {
    const priority = event.resource.priority;
    return {
      style: {
        backgroundColor: PRIORITY_BG[priority],
        border: `1px solid ${PRIORITY_BORDER[priority]}`,
        borderRadius: "6px",
        color: "#f9fafb",
        fontSize: "12px",
        padding: "2px 6px",
        opacity: event.resource.status === "DONE" ? 0.5 : 1,
      },
    };
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-2xl font-bold text-white">Calendar</h1>
        <p className="text-gray-400 mt-1">Tasks with due dates.</p>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3">
          {(["HIGH", "MEDIUM", "LOW"] as TaskPriority[]).map((p) => (
            <div key={p} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: PRIORITY_BORDER[p] }}
              />
              <span className="text-xs text-gray-400">{p}</span>
            </div>
          ))}
        </div>
      </div>

      {tasksLoading ? (
        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl animate-pulse" />
      ) : (
        <div className="flex-1 min-h-0 calendar-wrapper">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            eventPropGetter={eventStyleGetter}
            onSelectEvent={(event) =>
              setEditModal({ task: event.resource })
            }
            date={currentDate}
            onNavigate={setCurrentDate}
            view={currentView}
            onView={setCurrentView}
            style={{ height: "100%" }}
          />
        </div>
      )}

      {/* Edit modal — inline quick edit */}
      {editModal && (
        <CalendarTaskModal
          task={editModal.task}
          onClose={() => setEditModal(null)}
          onUpdated={(updated) => {
            setTasks(tasks.map((t) => (t.id === updated.id ? updated : t)));
            setEditModal(null);
          }}
        />
      )}

      <style jsx global>{`
        .calendar-wrapper .rbc-calendar {
          background: transparent;
          color: #f9fafb;
          font-family: inherit;
        }
        .calendar-wrapper .rbc-header {
          border-color: #374151;
          color: #9ca3af;
          font-size: 12px;
          padding: 8px 4px;
        }
        .calendar-wrapper .rbc-month-view,
        .calendar-wrapper .rbc-time-view,
        .calendar-wrapper .rbc-agenda-view {
          border-color: #374151;
          border-radius: 16px;
          overflow: hidden;
        }
        .calendar-wrapper .rbc-day-bg {
          background: #111827;
        }
        .calendar-wrapper .rbc-off-range-bg {
          background: #0d1117;
        }
        .calendar-wrapper .rbc-today {
          background: #1e1b4b;
        }
        .calendar-wrapper .rbc-date-cell {
          color: #9ca3af;
          font-size: 12px;
          padding: 4px 8px;
        }
        .calendar-wrapper .rbc-date-cell.rbc-current {
          color: #818cf8;
          font-weight: bold;
        }
        .calendar-wrapper .rbc-toolbar button {
          color: #9ca3af;
          border-color: #374151;
          background: transparent;
        }
        .calendar-wrapper .rbc-toolbar button:hover {
          color: #fff;
          background: #1f2937;
        }
        .calendar-wrapper .rbc-toolbar button.rbc-active {
          color: #fff;
          background: #4f46e5;
          border-color: #4f46e5;
        }
        .calendar-wrapper .rbc-toolbar .rbc-toolbar-label {
          color: #f9fafb;
          font-weight: 600;
        }
        .calendar-wrapper .rbc-show-more {
          color: #818cf8;
          font-size: 11px;
        }
        .calendar-wrapper .rbc-event:focus {
          outline: none;
        }
        .calendar-wrapper .rbc-row-content {
          z-index: 1;
        }
        .calendar-wrapper .rbc-month-row + .rbc-month-row {
          border-color: #374151;
        }
        .calendar-wrapper .rbc-day-bg + .rbc-day-bg {
          border-color: #374151;
        }
      `}</style>
    </div>
  );
}

// ─── Inline quick-edit modal for calendar ─────────────────────────────────────

function CalendarTaskModal({
  task,
  onClose,
  onUpdated,
}: {
  task: Task;
  onClose: () => void;
  onUpdated: (t: Task) => void;
}) {
  const [status, setStatus] = useState(task.status);
  const [saving, setSaving] = useState(false);
  const { updateTask } = useTaskmasterStore();

  async function handleSave() {
    setSaving(true);
    try {
      const { data } = await axios.put<Task>(`/api/tasks/${task.id}`, { status });
      updateTask(task.id, { status });
      onUpdated(data);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-sm shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white font-semibold mb-1">{task.title}</h3>
        {task.description && (
          <p className="text-gray-400 text-sm mb-4">{task.description}</p>
        )}
        {task.dueDate && (
          <p className="text-xs text-gray-500 mb-4">
            Due:{" "}
            {new Date(task.dueDate).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as Task["status"])
            }
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors text-sm"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={saving || status === task.status}
            className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 disabled:opacity-50 text-sm transition-colors"
          >
            {saving ? "Saving…" : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
}
