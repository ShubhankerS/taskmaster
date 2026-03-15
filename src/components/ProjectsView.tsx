// FILE: ~/taskmaster/src/components/ProjectsView.tsx
// Projects list/grid view — create, view, and delete projects.

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Link from "next/link";
import { useTaskmasterStore, type Project } from "@/lib/store";

const PROJECT_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
];

interface ProjectsResponse {
  projects: Project[];
  nextCursor: string | null;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProjectsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-gray-900 rounded-2xl border border-gray-800 p-5 animate-pulse"
        >
          <div className="w-full h-1.5 rounded-full bg-gray-700 mb-4" />
          <div className="w-2/3 h-5 bg-gray-700 rounded mb-2" />
          <div className="w-full h-3 bg-gray-700 rounded mb-1" />
          <div className="w-3/4 h-3 bg-gray-700 rounded mb-4" />
          <div className="flex items-center gap-2 mt-4">
            <div className="w-16 h-5 bg-gray-700 rounded-lg" />
            <div className="w-20 h-4 bg-gray-700 rounded ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── New Project Modal ────────────────────────────────────────────────────────

function NewProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setFieldErrors({});
    try {
      const { data } = await axios.post<Project>("/api/projects", {
        name: name.trim(),
        description: description || null,
        color,
      });
      onCreated(data);
      onClose();
      toast.success("Project created");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.fields) {
        setFieldErrors(err.response.data.fields);
      } else {
        toast.error("Failed to create project");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">New Project</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Project Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder="My Project"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {fieldErrors.name?.map((e) => (
              <p key={e} className="text-red-400 text-xs mt-1">{e}</p>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === c
                      ? "scale-125 ring-2 ring-white ring-offset-2 ring-offset-gray-900"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Creating…" : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({
  project,
}: {
  project: Project & { _count?: { tasks: number } };
}) {
  const { removeProject } = useTaskmasterStore();

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const toastId = toast.loading("Deleting project…");
    try {
      await axios.delete(`/api/projects/${project.id}`);
      removeProject(project.id);
      toast.success("Project deleted", { id: toastId });
    } catch {
      toast.error("Failed to delete project", { id: toastId });
    }
  }

  const taskCount =
    (project as { _count?: { tasks: number } })._count?.tasks ?? 0;

  return (
    <Link
      href={`/dashboard/projects/${project.id}`}
      className="block bg-gray-900 rounded-2xl border border-gray-800 p-5 hover:border-gray-700 transition-colors group"
    >
      {/* Color bar */}
      <div
        className="w-full h-1.5 rounded-full mb-4"
        style={{ backgroundColor: project.color }}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-base truncate">
            {project.name}
          </h3>
          {project.description && (
            <p className="text-sm text-gray-400 mt-1 line-clamp-2">
              {project.description}
            </p>
          )}
        </div>
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity flex-shrink-0 text-sm"
          title="Delete project"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <span
          className="text-xs px-2 py-1 rounded-lg font-medium"
          style={{
            backgroundColor: project.color + "20",
            color: project.color,
          }}
        >
          {taskCount} {taskCount === 1 ? "task" : "tasks"}
        </span>
        <span className="text-xs text-gray-600 ml-auto">
          {new Date(project.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>
    </Link>
  );
}

// ─── Main Projects View ───────────────────────────────────────────────────────

export default function ProjectsView() {
  const { projects, projectsLoading, setProjects, setProjectsLoading, addProject } =
    useTaskmasterStore();
  const [showModal, setShowModal] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  const fetchProjects = useCallback(
    async (cursor?: string) => {
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (cursor) params.set("cursor", cursor);
        const { data } = await axios.get<ProjectsResponse>(
          `/api/projects?${params.toString()}`
        );
        if (cursor) {
          setProjects([...projects, ...(data.projects ?? [])]);
        } else {
          setProjects(data.projects ?? []);
        }
        setNextCursor(data.nextCursor);
      } catch {
        // ignore polling errors
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setProjects]
  );

  useEffect(() => {
    setProjectsLoading(true);
    fetchProjects().finally(() => setProjectsLoading(false));

    const es = new EventSource("/api/events");
    sseRef.current = es;
    es.addEventListener("ping", () => fetchProjects());
    es.onerror = () => es.close();

    return () => es.close();
  }, [fetchProjects, setProjectsLoading]);

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    await fetchProjects(nextCursor);
    setLoadingMore(false);
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-gray-400 mt-1">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          New Project
        </button>
      </div>

      {/* Grid */}
      {projectsLoading ? (
        <ProjectsSkeleton />
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📁</div>
          <h3 className="text-lg font-medium text-white mb-1">
            No projects yet
          </h3>
          <p className="text-gray-400 text-sm mb-6">
            Create your first project to organize your tasks.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2 rounded-xl transition-colors"
          >
            Create Project
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>

          {nextCursor && (
            <div className="flex justify-center pt-6">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="text-sm text-gray-400 hover:text-white disabled:opacity-50 underline"
              >
                {loadingMore ? "Loading…" : "Load more projects"}
              </button>
            </div>
          )}
        </>
      )}

      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onCreated={(p) => addProject(p)}
        />
      )}
    </div>
  );
}
