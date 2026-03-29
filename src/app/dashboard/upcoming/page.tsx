// FILE: ~/taskmaster/src/app/dashboard/upcoming/page.tsx
// Shows all tasks with due dates, sorted by due date and grouped into sections.

"use client";

import { useEffect, useCallback, useState } from "react";
import axios from "axios";
import { useTaskmasterStore, type Task } from "@/lib/store";
import {
  isToday,
  isThisWeek,
  isBefore,
  startOfToday,
  parseISO,
} from "date-fns";

function statusDot(status: Task["status"]) {
  switch (status) {
    case "DONE":        return "bg-green-500";
    case "IN_PROGRESS": return "bg-blue-500";
    case "TODO":        return "bg-yellow-500";
    case "BACKLOG":     return "bg-gray-500";
    case "WILD_IDEA":   return "bg-purple-500";
    case "WONT_DO":     return "bg-red-500";
    default:            return "bg-gray-500";
  }
}

function TaskItem({ task }: { task: Task }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-gray-800 last:border-0">
      <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${statusDot(task.status)}`} />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${
            task.status === "DONE" ? "line-through text-gray-500" : "text-white"
          }`}
        >
          {task.title}
        </p>
        {task.project && (
          <p className="text-xs mt-0.5" style={{ color: task.project.color }}>
            {task.project.name}
          </p>
        )}
        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {task.tags.map((tt) => (
              <span
                key={tt.tagId}
                className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: tt.tag.color + "25",
                  color: tt.tag.color,
                  border: `1px solid ${tt.tag.color}50`,
                }}
              >
                {tt.tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {task.dueDate && (
          <span className="text-xs text-gray-400">
            {new Date(task.dueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  tasks,
  accent,
}: {
  title: string;
  tasks: Task[];
  accent: string;
}) {
  if (tasks.length === 0) return null;
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl mb-4 overflow-hidden">
      <div
        className={`px-5 py-3 border-b border-gray-800 flex items-center gap-2`}
      >
        <span className={`text-sm font-semibold ${accent}`}>{title}</span>
        <span className="text-xs text-gray-600 bg-gray-800 rounded-full px-2 py-0.5">
          {tasks.length}
        </span>
      </div>
      <div className="px-5">
        {tasks.map((t) => (
          <TaskItem key={t.id} task={t} />
        ))}
      </div>
    </div>
  );
}

export default function UpcomingPage() {
  const { tasks, setTasks, tasksLoading, setTasksLoading } =
    useTaskmasterStore();
  const [hasFetched, setHasFetched] = useState(false);

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

  // Tasks with due dates, sorted soonest first
  const withDueDate = tasks
    .filter((t) => t.dueDate && t.status !== "DONE" && t.status !== "WONT_DO")
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  const overdue = withDueDate.filter(
    (t) => isBefore(parseISO(t.dueDate!), startOfToday())
  );
  const dueToday = withDueDate.filter((t) => isToday(parseISO(t.dueDate!)));
  const dueThisWeek = withDueDate.filter(
    (t) =>
      isThisWeek(parseISO(t.dueDate!), { weekStartsOn: 1 }) &&
      !isToday(parseISO(t.dueDate!))
  );
  const later = withDueDate.filter(
    (t) => !isThisWeek(parseISO(t.dueDate!), { weekStartsOn: 1 })
  );

  const doneTasks = tasks.filter((t) => t.status === "DONE" && t.dueDate);

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Upcoming</h1>
        <p className="text-gray-400 mt-1">
          Tasks with due dates, sorted by urgency.
        </p>
      </div>

      {tasksLoading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-5 h-24"
            />
          ))}
        </div>
      ) : withDueDate.length === 0 && doneTasks.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📅</div>
          <h3 className="text-lg font-medium text-white mb-1">
            No upcoming tasks
          </h3>
          <p className="text-gray-400 text-sm">
            Add due dates to tasks to see them here.
          </p>
        </div>
      ) : (
        <>
          <Section
            title="Overdue"
            tasks={overdue}
            accent="text-red-400"
          />
          <Section title="Due Today" tasks={dueToday} accent="text-yellow-400" />
          <Section
            title="Due This Week"
            tasks={dueThisWeek}
            accent="text-blue-400"
          />
          <Section title="Later" tasks={later} accent="text-gray-300" />

          {withDueDate.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-8">
              No pending tasks with due dates.
            </p>
          )}
        </>
      )}
    </div>
  );
}
