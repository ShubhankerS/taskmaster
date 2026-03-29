// FILE: ~/taskmaster/src/components/widgets/AnalyticsWidget.tsx
// Analytics Summary widget — today's tracked time + tasks completed today.

"use client";

import { useEffect, useCallback } from "react";
import axios from "axios";
import Link from "next/link";
import { useTaskmasterStore, type Task, type TimeLog } from "@/lib/store";

function formatLogDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

export default function AnalyticsWidget() {
  const { tasks, setTasks, timeLogs, setTimeLogs } = useTaskmasterStore();

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, logsRes] = await Promise.all([
        axios.get<{ tasks: Task[] }>("/api/tasks?limit=50"),
        axios.get<{ timeLogs: TimeLog[] }>("/api/time-logs?limit=50"),
      ]);
      setTasks(tasksRes.data.tasks ?? []);
      setTimeLogs(logsRes.data.timeLogs ?? []);
    } catch { /* ignore */ }
  }, [setTasks, setTimeLogs]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const todaySeconds = timeLogs
    .filter((l) => l.duration !== null && isToday(l.startTime))
    .reduce((sum, l) => sum + (l.duration ?? 0), 0);

  const completedToday = tasks.filter(
    (t) => t.status === "DONE" && isToday(t.updatedAt)
  ).length;

  const inProgress = tasks.filter(
    (t) => t.status === "IN_PROGRESS" && !t.parentTaskId
  ).length;

  const totalBigIdeas = tasks.filter((t) => !t.parentTaskId && t.status !== "WONT_DO").length;
  const doneBigIdeas = tasks.filter(
    (t) => !t.parentTaskId && t.status === "DONE"
  ).length;

  return (
    <div className="p-4 h-full overflow-y-auto flex flex-col gap-3">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-800 rounded-xl px-3 py-4 text-center">
          <p className="text-3xl font-bold text-white font-mono">
            {formatLogDuration(todaySeconds)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Tracked today</p>
        </div>

        <div className="bg-gray-800 rounded-xl px-3 py-4 text-center">
          <p className="text-3xl font-bold text-white">
            {completedToday}
          </p>
          <p className="text-xs text-gray-400 mt-1">Completed today</p>
        </div>

        <div className="bg-gray-800 rounded-xl px-3 py-4 text-center">
          <p className="text-3xl font-bold text-white">
            {inProgress}
          </p>
          <p className="text-xs text-gray-400 mt-1">In progress</p>
        </div>

        <div className="bg-gray-800 rounded-xl px-3 py-4 text-center">
          <p className="text-3xl font-bold text-white">
            {totalBigIdeas > 0 ? Math.round((doneBigIdeas / totalBigIdeas) * 100) : 0}%
          </p>
          <p className="text-xs text-gray-400 mt-1">All-time done</p>
        </div>
      </div>

      <Link
        href="/dashboard/analytics"
        className="text-xs text-indigo-400 hover:text-indigo-300 text-center mt-auto pt-2 transition-colors"
      >
        View Analytics →
      </Link>
    </div>
  );
}
