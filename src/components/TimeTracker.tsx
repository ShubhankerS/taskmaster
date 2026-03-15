// FILE: ~/taskmaster/src/components/TimeTracker.tsx
// Time tracking component — select a task, start/stop timer, view history.

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  useTaskmasterStore,
  type Task,
  type TimeLog,
  type ActiveTimer,
} from "@/lib/store";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatLogDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TimeLogSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 py-3 border-b border-gray-800 animate-pulse"
        >
          <div className="flex-1 space-y-1.5">
            <div className="w-2/3 h-4 bg-gray-700 rounded" />
            <div className="w-1/3 h-3 bg-gray-700 rounded" />
          </div>
          <div className="w-10 h-5 bg-gray-700 rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Log History Row ──────────────────────────────────────────────────────────

interface TimeLogsResponse {
  timeLogs: TimeLog[];
  nextCursor: string | null;
}

function TimeLogRow({ log, onDelete }: { log: TimeLog; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const toastId = toast.loading("Deleting…");
    try {
      await axios.delete(`/api/time-logs/${log.id}`);
      onDelete(log.id);
      toast.success("Time log deleted", { id: toastId });
    } catch {
      toast.error("Failed to delete time log", { id: toastId });
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-800 last:border-0 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {log.task?.title ?? "Unknown task"}
        </p>
        {log.description && (
          <p className="text-xs text-gray-400 truncate">{log.description}</p>
        )}
        <p className="text-xs text-gray-500 mt-0.5">
          {new Date(log.startTime).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
      {log.duration !== null && (
        <span className="text-sm font-mono font-medium text-indigo-400 flex-shrink-0">
          {formatLogDuration(log.duration)}
        </span>
      )}
      {log.duration === null && (
        <span className="text-xs text-green-400 flex-shrink-0 animate-pulse">
          Running
        </span>
      )}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity text-xs flex-shrink-0 disabled:opacity-30"
        title="Delete time log"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Main TimeTracker ─────────────────────────────────────────────────────────

export default function TimeTracker() {
  const {
    tasks,
    setTasks,
    timeLogs,
    timeLogsLoading,
    setTimeLogs,
    setTimeLogsLoading,
    addTimeLog,
    removeTimeLog,
    activeTimer,
    setActiveTimer,
    tickTimer,
  } = useTaskmasterStore();

  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [description, setDescription] = useState("");
  const [startingTimer, setStartingTimer] = useState(false);
  const [stoppingTimer, setStoppingTimer] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  // Active timer tick — runs every second when a timer is active.
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (activeTimer) {
      tickRef.current = setInterval(tickTimer, 1000);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [activeTimer, tickTimer]);

  // ── Data Fetching ───────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    try {
      const { data } = await axios.get<{ tasks: Task[] }>("/api/tasks");
      setTasks(data.tasks ?? data);
    } catch {
      // ignore
    }
  }, [setTasks]);

  const fetchLogs = useCallback(
    async (cursor?: string) => {
      try {
        const params = new URLSearchParams({ limit: "20" });
        if (cursor) params.set("cursor", cursor);
        const { data } = await axios.get<TimeLogsResponse>(
          `/api/time-logs?${params.toString()}`
        );
        if (cursor) {
          setTimeLogs([...timeLogs, ...(data.timeLogs ?? [])]);
        } else {
          setTimeLogs(data.timeLogs ?? []);
        }
        setNextCursor(data.nextCursor);
      } catch {
        // ignore
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setTimeLogs]
  );

  useEffect(() => {
    setTimeLogsLoading(true);
    Promise.all([fetchTasks(), fetchLogs()]).finally(() =>
      setTimeLogsLoading(false)
    );

    const es = new EventSource("/api/events");
    sseRef.current = es;
    es.addEventListener("ping", () => fetchLogs());
    es.onerror = () => es.close();

    return () => es.close();
  }, [fetchTasks, fetchLogs, setTimeLogsLoading]);

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    await fetchLogs(nextCursor);
    setLoadingMore(false);
  }

  // ── Timer Controls ──────────────────────────────────────────────────────────

  async function handleStart() {
    if (!selectedTaskId) return;
    setStartingTimer(true);
    const toastId = toast.loading("Starting timer…");
    try {
      const now = new Date();
      const { data } = await axios.post<TimeLog>("/api/time-logs", {
        taskId: selectedTaskId,
        description: description || null,
        startTime: now.toISOString(),
      });

      const task = tasks.find((t) => t.id === selectedTaskId);
      const timer: ActiveTimer = {
        taskId: data.taskId,
        taskTitle: task?.title ?? "Unknown task",
        startTime: new Date(data.startTime),
        elapsedSeconds: 0,
      };
      setActiveTimer(timer);
      addTimeLog(data);
      setDescription("");
      toast.success("Timer started", { id: toastId });
    } catch {
      toast.error("Failed to start timer", { id: toastId });
    } finally {
      setStartingTimer(false);
    }
  }

  async function handleStop() {
    if (!activeTimer) return;
    setStoppingTimer(true);
    const toastId = toast.loading("Stopping timer…");
    try {
      const now = new Date();
      const duration = Math.round(
        (now.getTime() - activeTimer.startTime.getTime()) / 1000
      );

      const runningLog = timeLogs.find(
        (l) => l.taskId === activeTimer.taskId && l.endTime === null
      );

      if (runningLog) {
        await axios.post<TimeLog>("/api/time-logs", {
          taskId: activeTimer.taskId,
          startTime: activeTimer.startTime.toISOString(),
          endTime: now.toISOString(),
          duration,
        });
      }

      setActiveTimer(null);
      await fetchLogs();
      toast.success(`Timer stopped — ${formatLogDuration(duration)}`, {
        id: toastId,
      });
    } catch {
      toast.error("Failed to stop timer", { id: toastId });
    } finally {
      setStoppingTimer(false);
    }
  }

  // ── Today's stats ───────────────────────────────────────────────────────────
  const todayLogs = timeLogs.filter((l) => {
    const d = new Date(l.startTime);
    const today = new Date();
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate() &&
      l.duration !== null
    );
  });
  const todaySeconds = todayLogs.reduce((sum, l) => sum + (l.duration ?? 0), 0);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Time Tracker</h1>
        <p className="text-gray-400 mt-1">Track time spent on your tasks.</p>
      </div>

      {/* ── Active timer display ─────────────────────────────────────────── */}
      {activeTimer && (
        <div className="bg-indigo-900/30 border border-indigo-700 rounded-2xl p-5 mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-indigo-300 font-medium uppercase tracking-wider mb-1">
              Currently tracking
            </p>
            <p className="text-white font-semibold">{activeTimer.taskTitle}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-mono font-bold text-indigo-300">
              {formatDuration(activeTimer.elapsedSeconds)}
            </p>
            <button
              onClick={handleStop}
              disabled={stoppingTimer}
              className="mt-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              {stoppingTimer ? "Stopping…" : "Stop"}
            </button>
          </div>
        </div>
      )}

      {/* ── Start timer form ─────────────────────────────────────────────── */}
      {!activeTimer && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
            Start Timer
          </h2>

          <div className="space-y-3">
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select a task…</option>
              {tasks
                .filter((t) => t.status !== "DONE")
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                    {t.project ? ` (${t.project.name})` : ""}
                  </option>
                ))}
            </select>

            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you working on? (optional)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <button
              onClick={handleStart}
              disabled={!selectedTaskId || startingTimer}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition-colors"
            >
              {startingTimer ? "Starting…" : "Start Timer"}
            </button>
          </div>
        </div>
      )}

      {/* ── Today's summary ──────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Today
          </h2>
          <span className="text-xl font-mono font-bold text-white">
            {formatLogDuration(todaySeconds)}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {todayLogs.length} session{todayLogs.length !== 1 ? "s" : ""} logged
        </p>
      </div>

      {/* ── Recent log history ────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
          Recent Sessions
        </h2>

        {timeLogsLoading ? (
          <TimeLogSkeleton />
        ) : timeLogs.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-6">
            No time logs yet. Start a timer to begin tracking.
          </p>
        ) : (
          <div>
            {timeLogs.map((log) => (
              <TimeLogRow
                key={log.id}
                log={log}
                onDelete={(id) => removeTimeLog(id)}
              />
            ))}
            {nextCursor && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="text-sm text-gray-400 hover:text-white disabled:opacity-50 underline"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
