// FILE: ~/taskmaster/src/app/dashboard/projects/[id]/page.tsx
// Project detail page — shows project info and all tasks in the project.

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import Link from "next/link";
import type { Task, TaskStatus, TaskPriority, Project } from "@/lib/store";

const STATUS_LABELS: Record<TaskStatus, string> = {
  WILD_IDEA:   "Wild Idea",
  BACKLOG:     "Backlog",
  TODO:        "To Do",
  IN_PROGRESS: "In Progress",
  DONE:        "Done",
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW: "bg-gray-700 text-gray-300",
  MEDIUM: "bg-yellow-900 text-yellow-300",
  HIGH: "bg-red-900 text-red-300",
};

interface ProjectWithTasks extends Project {
  tasks: Task[];
  _count: { tasks: number };
}

function TaskRow({ task }: { task: Task }) {
  const isOverdue =
    task.dueDate &&
    task.status !== "DONE" &&
    new Date(task.dueDate) < new Date();

  return (
    <div className="flex items-start gap-4 py-3 border-b border-gray-800 last:border-0">
      <div
        className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
          task.status === "DONE"
            ? "bg-green-500"
            : task.status === "IN_PROGRESS"
            ? "bg-blue-500"
            : "bg-gray-500"
        }`}
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${
            task.status === "DONE"
              ? "line-through text-gray-500"
              : "text-white"
          }`}
        >
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {task.description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority]}`}
        >
          {task.priority}
        </span>
        <span className="text-xs text-gray-500">
          {STATUS_LABELS[task.status]}
        </span>
        {task.dueDate && (
          <span
            className={`text-xs ${isOverdue ? "text-red-400" : "text-gray-500"}`}
          >
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

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectWithTasks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
  const [deleting, setDeleting] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      const { data } = await axios.get<ProjectWithTasks>(`/api/projects/${id}`);
      setProject(data);
    } catch {
      setError("Failed to load project");
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetchProject().finally(() => setLoading(false));
  }, [fetchProject]);

  async function handleDelete() {
    setDeleting(true);
    const toastId = toast.loading("Deleting project…");
    try {
      await axios.delete(`/api/projects/${id}`);
      toast.success("Project deleted", { id: toastId });
      router.push("/dashboard/projects");
    } catch {
      toast.error("Failed to delete project", { id: toastId });
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="w-48 h-8 bg-gray-700 rounded mb-2" />
        <div className="w-64 h-4 bg-gray-700 rounded mb-6" />
        <div className="w-full h-24 bg-gray-800 rounded-2xl" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-gray-400 mb-4">{error || "Project not found"}</p>
        <Link
          href="/dashboard/projects"
          className="text-indigo-400 hover:text-indigo-300 underline"
        >
          Back to Projects
        </Link>
      </div>
    );
  }

  const filteredTasks =
    statusFilter === "ALL"
      ? project.tasks
      : project.tasks.filter((t) => t.status === statusFilter);

  const taskStats = {
    total: project.tasks.length,
    done: project.tasks.filter((t) => t.status === "DONE").length,
    inProgress: project.tasks.filter((t) => t.status === "IN_PROGRESS").length,
    todo: project.tasks.filter((t) => t.status === "TODO").length,
  };

  const completionPercent =
    taskStats.total > 0
      ? Math.round((taskStats.done / taskStats.total) * 100)
      : 0;

  return (
    <div className="p-6 max-w-4xl">
      {/* Back link */}
      <Link
        href="/dashboard/projects"
        className="text-sm text-gray-400 hover:text-white flex items-center gap-1 mb-4"
      >
        ← Back to Projects
      </Link>

      {/* Project header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: project.color }}
            />
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          </div>
          {project.description && (
            <p className="text-gray-400 text-sm">{project.description}</p>
          )}
          <p className="text-xs text-gray-600 mt-1">
            Created{" "}
            {new Date(project.createdAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-gray-500 hover:text-red-400 transition-colors text-sm disabled:opacity-50"
        >
          Delete Project
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total", value: taskStats.total, color: "text-white" },
          { label: "To Do", value: taskStats.todo, color: "text-gray-400" },
          {
            label: "In Progress",
            value: taskStats.inProgress,
            color: "text-blue-400",
          },
          { label: "Done", value: taskStats.done, color: "text-green-400" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4"
          >
            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {taskStats.total > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Completion</span>
            <span className="text-xs font-medium text-white">
              {completionPercent}%
            </span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${completionPercent}%`,
                backgroundColor: project.color,
              }}
            />
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white">
            Tasks ({filteredTasks.length})
          </h2>

          {/* Status filter */}
          <div className="flex rounded-lg border border-gray-700 overflow-hidden text-xs">
            {(["ALL", "TODO", "IN_PROGRESS", "DONE"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 transition-colors ${
                  statusFilter === s
                    ? "bg-indigo-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {s === "ALL" ? "All" : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5">
          {filteredTasks.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              No tasks{statusFilter !== "ALL" ? ` with status "${STATUS_LABELS[statusFilter]}"` : ""}.
            </p>
          ) : (
            filteredTasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
