// FILE: ~/taskmaster/src/components/KanbanBoard.tsx
// Drag-and-drop Kanban board.
// Big Ideas = top-level tasks. Small Ideas = child tasks (shown inline as nested boxes).
// Supports tag filtering, priority/project filters, and SSE real-time updates.
// Cards flip 180° on click to reveal an inline edit back face.

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import axios from "axios";
import toast from "react-hot-toast";
import {
  useTaskmasterStore,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type Tag,
  type TaskTag,
} from "@/lib/store";

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMNS: { id: TaskStatus; label: string; dotColor: string; highlightColor: string }[] = [
  { id: "WILD_IDEA",   label: "Wild Idea",   dotColor: "bg-purple-500", highlightColor: "bg-purple-900/20" },
  { id: "BACKLOG",     label: "Backlog",     dotColor: "bg-gray-500",   highlightColor: "bg-gray-700/30"   },
  { id: "TODO",        label: "To Do",       dotColor: "bg-blue-500",   highlightColor: "bg-blue-900/20"   },
  { id: "IN_PROGRESS", label: "In Progress", dotColor: "bg-yellow-500", highlightColor: "bg-yellow-900/20" },
  { id: "DONE",        label: "Done",        dotColor: "bg-green-500",  highlightColor: "bg-green-900/20"  },
  { id: "WONT_DO",     label: "Won't Do",    dotColor: "bg-red-500",    highlightColor: "bg-red-900/20"    },
];

// Status-based card left border color
const STATUS_BORDER_COLOR: Record<TaskStatus, string> = {
  WILD_IDEA:   "border-l-purple-500",
  BACKLOG:     "border-l-gray-500",
  TODO:        "border-l-blue-500",
  IN_PROGRESS: "border-l-yellow-500",
  DONE:        "border-l-green-500",
  WONT_DO:     "border-l-red-500",
};

const STATUS_HEX: Record<TaskStatus, string> = {
  WILD_IDEA:   "#a855f7",
  BACKLOG:     "#6b7280",
  TODO:        "#3b82f6",
  IN_PROGRESS: "#eab308",
  DONE:        "#22c55e",
  WONT_DO:     "#ef4444",
};

const TAG_PALETTE = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#14b8a6",
];

// ─── API response shape (paginated) ──────────────────────────────────────────

interface TasksResponse {
  tasks: Task[];
  nextCursor: string | null;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function KanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-full">
      {COLUMNS.map((col) => (
        <div
          key={col.id}
          className="bg-gray-900 border border-gray-800 rounded-xl w-72 flex-shrink-0 flex flex-col"
        >
          <div className="border-b border-gray-800 px-4 py-3 rounded-t-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${col.dotColor} animate-pulse`} />
              <div className="w-20 h-4 bg-gray-700 rounded animate-pulse" />
            </div>
          </div>
          <div className="p-3 space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-gray-800 rounded-xl p-4 animate-pulse border-l-4 border-l-gray-700"
              >
                <div className="w-3/4 h-4 bg-gray-700 rounded mb-2" />
                <div className="w-1/2 h-3 bg-gray-700 rounded mb-3" />
                <div className="flex gap-2">
                  <div className="w-14 h-5 bg-gray-700 rounded-full" />
                  <div className="w-20 h-5 bg-gray-700 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tag Selector (used inside modal and card back face) ──────────────────────

function TagSelector({
  taskId,
  currentTags,
  onTagsChanged,
}: {
  taskId: string | null;
  currentTags: TaskTag[];
  onTagsChanged: (tags: TaskTag[]) => void;
}) {
  const { tags, addTag } = useTaskmasterStore();
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_PALETTE[0]);
  const [creating, setCreating] = useState(false);

  const activeTagIds = new Set(currentTags.map((tt) => tt.tagId));

  async function toggleTag(tag: Tag) {
    if (!taskId) {
      if (activeTagIds.has(tag.id)) {
        onTagsChanged(currentTags.filter((tt) => tt.tagId !== tag.id));
      } else {
        onTagsChanged([...currentTags, { tagId: tag.id, taskId: "", tag }]);
      }
      return;
    }

    if (activeTagIds.has(tag.id)) {
      try {
        await axios.delete(`/api/tasks/${taskId}/tags/${tag.id}`);
        onTagsChanged(currentTags.filter((tt) => tt.tagId !== tag.id));
      } catch {
        toast.error("Failed to remove tag");
      }
    } else {
      try {
        await axios.post(`/api/tasks/${taskId}/tags`, { tagId: tag.id });
        onTagsChanged([...currentTags, { tagId: tag.id, taskId, tag }]);
      } catch {
        toast.error("Failed to add tag");
      }
    }
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) return;
    setCreating(true);
    try {
      const { data } = await axios.post<Tag>("/api/tags", {
        name: newTagName.trim(),
        color: newTagColor,
      });
      addTag(data);
      setNewTagName("");
      if (taskId) {
        await axios.post(`/api/tasks/${taskId}/tags`, { tagId: data.id });
        onTagsChanged([...currentTags, { tagId: data.id, taskId, tag: data }]);
      } else {
        onTagsChanged([...currentTags, { tagId: data.id, taskId: "", tag: data }]);
      }
      toast.success(`Tag "${data.name}" created`);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.fields?.name) {
        toast.error(err.response.data.fields.name[0]);
      } else {
        toast.error("Failed to create tag");
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium text-white/40 mb-1.5">
        Tags
      </label>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag) => {
            const active = activeTagIds.has(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${
                  active ? "ring-2 ring-white/30" : "opacity-50 hover:opacity-80"
                }`}
                style={{
                  backgroundColor: tag.color + (active ? "33" : "1a"),
                  color: tag.color,
                  borderColor: tag.color + "60",
                }}
              >
                {active && <span className="mr-1">✓</span>}
                {tag.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreateTag();
            }
          }}
          placeholder="New tag name…"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-xs placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        />
        <div className="flex gap-1">
          {TAG_PALETTE.slice(0, 5).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setNewTagColor(c)}
              className={`w-5 h-5 rounded-full transition-transform ${
                newTagColor === c ? "scale-125 ring-1 ring-white" : "hover:scale-110"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={handleCreateTag}
          disabled={creating || !newTagName.trim()}
          className="px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs rounded-xl transition-colors whitespace-nowrap"
        >
          {creating ? "…" : "+ Create"}
        </button>
      </div>
    </div>
  );
}

// ─── Small Ideas Section (used inside BigIdeaCard front face) ─────────────────

function SmallIdeasSection({
  task,
  parentStatus,
  onToggle,
  onDelete,
  onAdd,
}: {
  task: Task;
  parentStatus: TaskStatus;
  onToggle: (smallId: string, currentStatus: TaskStatus, e: React.MouseEvent) => void;
  onDelete: (smallId: string, e: React.MouseEvent) => void;
  onAdd: (title: string) => void;
}) {
  const smallIdeas = task.subtasks ?? [];
  const totalSmall = smallIdeas.length;
  const doneSmall = smallIdeas.filter((s) => s.status === "DONE").length;
  const allSmallDone = totalSmall > 0 && doneSmall === totalSmall;
  const accentHex = STATUS_HEX[parentStatus];

  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const VISIBLE_LIMIT = 3;
  const visibleIdeas = showAll ? smallIdeas : smallIdeas.slice(0, VISIBLE_LIMIT);
  const hiddenCount = smallIdeas.length - VISIBLE_LIMIT;

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setNewTitle("");
      setShowInput(false);
      return;
    }
    if (e.key === "Enter" && newTitle.trim()) {
      e.preventDefault();
      setAdding(true);
      try {
        await onAdd(newTitle.trim());
        setNewTitle("");
        setShowInput(false);
      } finally {
        setAdding(false);
      }
    }
  }

  return (
    <div className="mt-2">
      {/* Progress bar */}
      {totalSmall > 0 && (
        <div className="w-full bg-white/10 rounded-full h-1 mb-2">
          <div
            className={`h-1 rounded-full transition-all ${allSmallDone ? "bg-green-500" : "bg-indigo-500"}`}
            style={{ width: `${(doneSmall / totalSmall) * 100}%` }}
          />
        </div>
      )}

      {/* Section header — clickable to collapse */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setCollapsed((c) => !c); }}
        className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 mb-1.5 w-full text-left transition-colors"
      >
        <span className="text-white/20">{collapsed ? "▶" : "▼"}</span>
        <span className="font-medium">
          Small Ideas ({doneSmall}/{totalSmall})
        </span>
      </button>

      {!collapsed && (
        <>
          {/* Small idea boxes */}
          {visibleIdeas.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-1.5">
              {visibleIdeas.map((si) => (
                <div
                  key={si.id}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 border transition-colors"
                  style={si.status === "DONE" ? {
                    backgroundColor: accentHex + "10",
                    borderColor: accentHex + "30",
                  } : {
                    backgroundColor: accentHex + "18",
                    borderColor: accentHex + "50",
                  }}
                >
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={(e) => onToggle(si.id, si.status, e)}
                    className={`w-3.5 h-3.5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      si.status === "DONE"
                        ? "bg-green-500 border-green-500"
                        : "border-white/30 hover:border-green-400"
                    }`}
                  >
                    {si.status === "DONE" && (
                      <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Title */}
                  <span
                    className={`text-xs flex-1 leading-tight ${
                      si.status === "DONE" ? "line-through text-white/20" : "text-white/60"
                    }`}
                  >
                    {si.title}
                  </span>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={(e) => onDelete(si.id, e)}
                    className="text-white/20 hover:text-red-400 text-xs flex-shrink-0 leading-none transition-colors px-0.5"
                    title="Delete small idea"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Show more / less */}
          {!showAll && hiddenCount > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowAll(true); }}
              className="text-xs text-indigo-400 hover:text-indigo-300 mb-1.5 transition-colors"
            >
              Show {hiddenCount} more
            </button>
          )}
          {showAll && totalSmall > VISIBLE_LIMIT && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowAll(false); }}
              className="text-xs text-white/30 hover:text-white/50 mb-1.5 transition-colors"
            >
              Show less
            </button>
          )}

          {/* Inline add */}
          {showInput ? (
            <input
              autoFocus
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => { if (!newTitle.trim()) setShowInput(false); }}
              onClick={(e) => e.stopPropagation()}
              disabled={adding}
              placeholder="Add small idea… (Enter)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:border-transparent transition-colors disabled:opacity-50"
              style={{ "--tw-ring-color": accentHex } as React.CSSProperties}
            />
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowInput(true); }}
              className="text-white/25 hover:text-white/60 text-base leading-none transition-colors px-0.5"
              title="Add small idea"
            >
              +
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Small Ideas Section inside the modal (edit mode only) ───────────────────

function ModalSmallIdeasSection({
  task,
  localSmallIdeas,
  onToggle,
  onDelete,
  onAdd,
}: {
  task: Task;
  localSmallIdeas: Task[];
  onToggle: (smallId: string, currentStatus: TaskStatus) => void;
  onDelete: (smallId: string) => void;
  onAdd: () => void;
}) {
  const totalSmall = localSmallIdeas.length;
  const doneSmall = localSmallIdeas.filter((s) => s.status === "DONE").length;

  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const VISIBLE_LIMIT = 3;
  const visibleIdeas = showAll ? localSmallIdeas : localSmallIdeas.slice(0, VISIBLE_LIMIT);
  const hiddenCount = localSmallIdeas.length - VISIBLE_LIMIT;

  // expose newTitle to parent via a ref-like trick using a callback on the onAdd call
  const newTitleRef = useRef(newTitle);
  newTitleRef.current = newTitle;

  async function handleAdd() {
    if (!newTitleRef.current.trim()) return;
    setAdding(true);
    try {
      const { data } = await axios.post<Task>("/api/tasks", {
        title: newTitleRef.current.trim(),
        status: "TODO",
        priority: "MEDIUM",
        parentTaskId: task.id,
      });
      void data;
      onAdd();
      setNewTitle("");
    } catch {
      toast.error("Failed to add Small Idea");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      {/* Section header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-1.5 text-sm font-medium text-white/60 mb-2 hover:text-white transition-colors"
      >
        <span className="text-white/30 text-xs">{collapsed ? "▶" : "▼"}</span>
        Small Ideas ({doneSmall}/{totalSmall})
      </button>

      {!collapsed && (
        <>
          {visibleIdeas.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-2">
              {visibleIdeas.map((si) => (
                <div
                  key={si.id}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 border transition-colors ${
                    si.status === "DONE"
                      ? "bg-gray-800/30 border-gray-700/50"
                      : "bg-gray-800 border-gray-700"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggle(si.id, si.status)}
                    className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      si.status === "DONE"
                        ? "bg-green-500 border-green-500"
                        : "border-white/30 hover:border-green-400"
                    }`}
                  >
                    {si.status === "DONE" && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className={`text-sm flex-1 ${si.status === "DONE" ? "line-through text-white/20" : "text-white/70"}`}>
                    {si.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDelete(si.id)}
                    className="text-white/20 hover:text-red-400 text-sm flex-shrink-0 transition-colors leading-none px-0.5"
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {!showAll && hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 mb-2 transition-colors"
            >
              Show {hiddenCount} more
            </button>
          )}
          {showAll && totalSmall > VISIBLE_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="text-xs text-white/30 hover:text-white/50 mb-2 transition-colors"
            >
              Show less
            </button>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="Add Small Idea…"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={adding || !newTitle.trim()}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm rounded-xl transition-colors"
            >
              {adding ? "…" : "Add"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Big Idea Modal (create only — edit now lives on card back face) ──────────

interface BigIdeaModalProps {
  mode: "create" | "edit";
  defaultStatus?: TaskStatus;
  task?: Task;
  onClose: () => void;
  onSaved: (task: Task) => void;
}

function BigIdeaModal({ mode, defaultStatus, task, onClose, onSaved }: BigIdeaModalProps) {
  const { projects } = useTaskmasterStore();
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "MEDIUM");
  const [projectId, setProjectId] = useState(task?.projectId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [localSmallIdeas, setLocalSmallIdeas] = useState<Task[]>(task?.subtasks ?? []);
  const [localTags, setLocalTags] = useState<TaskTag[]>(task?.tags ?? []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setFieldErrors({});
    try {
      const payload = {
        title: title.trim(),
        description: description || null,
        priority,
        projectId: projectId || null,
        ...(mode === "create" ? { status: defaultStatus ?? "BACKLOG" } : {}),
      };

      const { data } = mode === "create"
        ? await axios.post<Task>("/api/tasks", payload)
        : await axios.put<Task>(`/api/tasks/${task!.id}`, payload);

      if (mode === "create" && localTags.length > 0) {
        await Promise.all(
          localTags.map((tt) =>
            axios.post(`/api/tasks/${data.id}/tags`, { tagId: tt.tagId })
          )
        );
        try {
          const { data: fresh } = await axios.get<Task>(`/api/tasks/${data.id}`);
          onSaved(fresh);
        } catch {
          onSaved(data);
        }
      } else {
        onSaved(data);
      }

      onClose();
      toast.success(mode === "create" ? "Big Idea created" : "Big Idea updated");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.fields) {
        setFieldErrors(err.response.data.fields);
      } else {
        toast.error(mode === "create" ? "Failed to create Big Idea" : "Failed to update Big Idea");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleSmallIdea(smallId: string, currentStatus: TaskStatus) {
    const newStatus: TaskStatus = currentStatus === "DONE" ? "TODO" : "DONE";
    try {
      await axios.put(`/api/tasks/${smallId}`, { status: newStatus });
      setLocalSmallIdeas((prev) =>
        prev.map((s) => (s.id === smallId ? { ...s, status: newStatus } : s))
      );
    } catch {
      toast.error("Failed to update Small Idea");
    }
  }

  async function handleDeleteSmallIdea(smallId: string) {
    try {
      await axios.delete(`/api/tasks/${smallId}`);
      setLocalSmallIdeas((prev) => prev.filter((s) => s.id !== smallId));
      toast.success("Small Idea deleted");
    } catch {
      toast.error("Failed to delete Small Idea");
    }
  }

  async function handleAddSmallIdea() {
    if (!task) return;
    try {
      const { data: fresh } = await axios.get<Task>(`/api/tasks/${task.id}`);
      setLocalSmallIdeas(fresh.subtasks ?? []);
    } catch {
      // ignore — the inline component already handles its own toast
    }
  }

  const inputClass =
    "w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors";

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 sticky top-0 bg-gray-900 z-10">
          <h2 className="text-lg font-semibold text-white">
            {mode === "create" ? "New Big Idea" : "Edit Big Idea"}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              placeholder="What's the big idea?"
              className={inputClass}
            />
            {fieldErrors.title?.map((e) => (
              <p key={e} className="text-red-400 text-xs mt-1">{e}</p>
            ))}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional description"
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className={`${inputClass} appearance-none`}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>

          {/* Project */}
          {projects.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1">
                Project
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className={`${inputClass} appearance-none`}
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tags */}
          <TagSelector
            taskId={mode === "edit" ? (task?.id ?? null) : null}
            currentTags={localTags}
            onTagsChanged={setLocalTags}
          />

          {/* Small Ideas (edit mode only) */}
          {mode === "edit" && task && (
            <ModalSmallIdeasSection
              task={task}
              localSmallIdeas={localSmallIdeas}
              onToggle={handleToggleSmallIdea}
              onDelete={handleDeleteSmallIdea}
              onAdd={handleAddSmallIdea}
            />
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-medium hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {submitting
                ? mode === "create" ? "Creating…" : "Saving…"
                : mode === "create" ? "Create Big Idea" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Card Back Face (inline editor) ──────────────────────────────────────────

interface CardBackFaceProps {
  task: Task;
  onClose: () => void;
  onSaved: (updated: Task) => void;
  onDeleted: () => void;
}

function CardBackFace({ task, onClose, onSaved, onDeleted }: CardBackFaceProps) {
  const { projects, updateTask, removeTask } = useTaskmasterStore();

  const [title, setTitle] = useState(task.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [localTags, setLocalTags] = useState<TaskTag[]>(task.tags ?? []);
  const [localSmallIdeas, setLocalSmallIdeas] = useState<Task[]>(task.subtasks ?? []);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  const PRIORITY_STYLES: Record<TaskPriority, string> = {
    LOW:    "border-white/10 text-white/30",
    MEDIUM: "border-yellow-700/50 text-yellow-500/50",
    HIGH:   "border-red-700/50 text-red-500/50",
  };
  const PRIORITY_ACTIVE: Record<TaskPriority, string> = {
    LOW:    "bg-white/10 border-white/20 text-white/80",
    MEDIUM: "bg-yellow-900/50 border-yellow-600 text-yellow-300",
    HIGH:   "bg-red-900/50 border-red-600 text-red-300",
  };

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const { data } = await axios.put<Task>(`/api/tasks/${task.id}`, {
        title: title.trim(),
        description: description || null,
        priority,
        status,
      });
      // Merge in the local tags and small ideas since PUT may not return them fully
      const merged: Task = {
        ...data,
        tags: localTags,
        subtasks: localSmallIdeas,
      };
      updateTask(task.id, merged);
      onSaved(merged);
      toast.success("Big Idea saved");
      onClose();
    } catch {
      toast.error("Failed to save Big Idea");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await axios.delete(`/api/tasks/${task.id}`);
      removeTask(task.id);
      onDeleted();
      toast.success("Big Idea deleted");
    } catch {
      toast.error("Failed to delete Big Idea");
      setDeleting(false);
    }
  }

  async function handleToggleSmallIdea(smallId: string, currentStatus: TaskStatus) {
    const newStatus: TaskStatus = currentStatus === "DONE" ? "TODO" : "DONE";
    try {
      await axios.put(`/api/tasks/${smallId}`, { status: newStatus });
      setLocalSmallIdeas((prev) =>
        prev.map((s) => (s.id === smallId ? { ...s, status: newStatus } : s))
      );
    } catch {
      toast.error("Failed to update Small Idea");
    }
  }

  async function handleDeleteSmallIdea(smallId: string) {
    try {
      await axios.delete(`/api/tasks/${smallId}`);
      setLocalSmallIdeas((prev) => prev.filter((s) => s.id !== smallId));
    } catch {
      toast.error("Failed to delete Small Idea");
    }
  }

  async function handleAddSmallIdea() {
    try {
      const { data: fresh } = await axios.get<Task>(`/api/tasks/${task.id}`);
      setLocalSmallIdeas(fresh.subtasks ?? []);
    } catch {
      // ignore
    }
  }

  const totalSmall = localSmallIdeas.length;
  const doneSmall = localSmallIdeas.filter((s) => s.status === "DONE").length;

  const backInputClass =
    "w-full bg-gray-800 border border-gray-700 rounded-xl px-2.5 py-2 text-white text-xs placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors";

  return (
    // The back face sits absolutely, fills the wrapper, is rotated 180° by default
    // so it appears face-up when the wrapper is also rotated 180°.
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: "rotateY(180deg)",
        overflowY: "auto",
      }}
      className="rounded-xl border border-gray-700 bg-gray-800 p-3 flex flex-col gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Title */}
      <div className="flex items-start gap-1.5">
        {editingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setEditingTitle(false);
              if (e.key === "Escape") { setTitle(task.title); setEditingTitle(false); }
            }}
            className="flex-1 bg-gray-800 border border-indigo-500 rounded-lg px-2 py-1 text-white text-sm font-medium focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingTitle(true)}
            className="flex-1 text-left text-sm font-semibold text-white hover:text-indigo-300 transition-colors leading-snug"
            title="Click to edit title"
          >
            {title}
            <span className="ml-1 text-white/20 text-xs">✎</span>
          </button>
        )}
      </div>

      {/* Description */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="Add a description…"
        className={`${backInputClass} resize-none`}
      />

      {/* Priority pills */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-white/30 shrink-0">Priority:</span>
        {(["LOW", "MEDIUM", "HIGH"] as TaskPriority[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPriority(p)}
            className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-all ${
              priority === p ? PRIORITY_ACTIVE[p] : PRIORITY_STYLES[p]
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Status */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-white/30 shrink-0">Status:</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
        >
          {COLUMNS.map((col) => (
            <option key={col.id} value={col.id}>{col.label}</option>
          ))}
        </select>
      </div>

      {/* Tags */}
      <div>
        <div className="flex flex-wrap gap-1 mb-1">
          {localTags.map((tt) => (
            <button
              key={tt.tagId}
              type="button"
              onClick={async () => {
                try {
                  await axios.delete(`/api/tasks/${task.id}/tags/${tt.tagId}`);
                  setLocalTags((prev) => prev.filter((x) => x.tagId !== tt.tagId));
                } catch {
                  toast.error("Failed to remove tag");
                }
              }}
              className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 transition-opacity hover:opacity-70"
              style={{
                backgroundColor: tt.tag.color + "30",
                color: tt.tag.color,
                border: `1px solid ${tt.tag.color}55`,
              }}
              title="Click to remove tag"
            >
              {tt.tag.name}
              <span className="text-white/30 text-xs leading-none">×</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowTagSelector((v) => !v)}
            className="text-xs px-2 py-0.5 rounded-full border border-dashed border-white/20 text-white/30 hover:border-indigo-500/50 hover:text-indigo-400 transition-colors"
          >
            + Add tag
          </button>
        </div>
        {showTagSelector && (
          <div className="border border-gray-700 rounded-xl p-2 bg-gray-900">
            <TagSelector
              taskId={task.id}
              currentTags={localTags}
              onTagsChanged={setLocalTags}
            />
          </div>
        )}
      </div>

      {/* Small Ideas */}
      <ModalSmallIdeasSection
        task={{ ...task, subtasks: localSmallIdeas }}
        localSmallIdeas={localSmallIdeas}
        onToggle={handleToggleSmallIdea}
        onDelete={handleDeleteSmallIdea}
        onAdd={handleAddSmallIdea}
      />

      {/* Small ideas progress bar */}
      {totalSmall > 0 && (
        <div className="w-full bg-white/10 rounded-full h-1">
          <div
            className={`h-1 rounded-full transition-all ${doneSmall === totalSmall ? "bg-green-500" : "bg-indigo-500"}`}
            style={{ width: `${(doneSmall / totalSmall) * 100}%` }}
          />
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center gap-2 pt-1 mt-auto">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-3 py-1.5 rounded-xl border border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white text-xs transition-colors"
        >
          Close
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="flex-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {/* Project selector (compact) */}
        {projects.length > 0 && (
          <select
            value={task.projectId ?? ""}
            onChange={async (e) => {
              const newProjectId = e.target.value || null;
              try {
                const { data } = await axios.put<Task>(`/api/tasks/${task.id}`, {
                  projectId: newProjectId,
                });
                updateTask(task.id, { projectId: data.projectId, project: data.project });
              } catch {
                toast.error("Failed to update project");
              }
            }}
            className="bg-gray-800 border border-gray-700 rounded-xl px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
            title="Project"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        {/* Delete */}
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="p-1.5 rounded-xl text-white/20 hover:text-red-400 hover:bg-red-900/20 disabled:opacity-50 transition-colors"
          title="Delete Big Idea"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Big Idea Card ────────────────────────────────────────────────────────────

function BigIdeaCard({
  task,
  index,
  isFlipped,
  onFlip,
  onUnflip,
  onSaved,
}: {
  task: Task;
  index: number;
  isFlipped: boolean;
  onFlip: () => void;
  onUnflip: () => void;
  onSaved: (updated: Task) => void;
}) {
  const { updateTask } = useTaskmasterStore();

  async function handleToggleSmallIdea(
    smallId: string,
    currentStatus: TaskStatus,
    e: React.MouseEvent
  ) {
    e.stopPropagation();
    const newStatus: TaskStatus = currentStatus === "DONE" ? "TODO" : "DONE";
    try {
      await axios.put<Task>(`/api/tasks/${smallId}`, { status: newStatus });
      const updatedSubtasks = (task.subtasks ?? []).map((s) =>
        s.id === smallId ? { ...s, status: newStatus } : s
      );
      updateTask(task.id, { subtasks: updatedSubtasks });
    } catch {
      toast.error("Failed to update Small Idea");
    }
  }

  async function handleDeleteSmallIdea(smallId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await axios.delete(`/api/tasks/${smallId}`);
      const updatedSubtasks = (task.subtasks ?? []).filter((s) => s.id !== smallId);
      updateTask(task.id, { subtasks: updatedSubtasks });
    } catch {
      toast.error("Failed to delete Small Idea");
    }
  }

  async function handleAddSmallIdea(title: string) {
    const { data } = await axios.post<Task>("/api/tasks", {
      title,
      status: "TODO",
      priority: "MEDIUM",
      parentTaskId: task.id,
    });
    const updatedSubtasks = [...(task.subtasks ?? []), data];
    updateTask(task.id, { subtasks: updatedSubtasks });
  }

  const smallIdeas = task.subtasks ?? [];
  const totalSmall = smallIdeas.length;
  const doneSmall = smallIdeas.filter((s) => s.status === "DONE").length;
  const allSmallDone = totalSmall > 0 && doneSmall === totalSmall;

  const borderColor = STATUS_BORDER_COLOR[task.status];

  // Estimate front face height so the wrapper reserves enough room.
  const estimatedFrontHeight = 100 + totalSmall * 36 + (totalSmall > 0 ? 20 : 0);
  const wrapperHeight = isFlipped
    ? Math.max(380, estimatedFrontHeight)
    : estimatedFrontHeight;

  return (
    <Draggable draggableId={task.id} index={index} isDragDisabled={isFlipped}>
      {(provided, snapshot) => {
        const card = (
        // Outer wrapper: drag root
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          style={{
            ...provided.draggableProps.style,
            userSelect: "none",
            height: `${wrapperHeight}px`,
            minHeight: `${wrapperHeight}px`,
          }}
          className="relative"
        >
          {/* Perspective wrapper — separate from drag root so dnd transform is clean 2D */}
          <div style={{ perspective: "1000px", width: "100%", height: "100%" }}>
          {/* Inner flip container */}
          <div
            style={{
              transformStyle: "preserve-3d",
              transition: "transform 0.5s",
              transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              width: "100%",
              height: "100%",
              position: "relative",
            }}
          >
            {/* ── FRONT FACE ─────────────────────────────────── */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
              {...provided.dragHandleProps}
              onClick={onFlip}
              className={`bg-gray-900 border border-gray-800 rounded-xl p-3.5 border-l-4 ${borderColor} cursor-grab active:cursor-grabbing group transition-colors ${
                snapshot.isDragging
                  ? "shadow-lg opacity-90"
                  : ""
              }`}
            >

              {/* Header row */}
              <div className="flex items-start justify-between gap-2 mb-1 pl-4">
                <p className={`text-sm font-medium leading-snug flex-1 ${
                  task.status === "DONE" || task.status === "WONT_DO"
                    ? "line-through text-white/30"
                    : "text-white/90"
                }`}>
                  {task.title}
                  {allSmallDone && totalSmall > 0 && (
                    <span className="ml-1.5 text-green-400 text-xs">✓</span>
                  )}
                </p>
              </div>

              {/* Description */}
              {task.description && (
                <p className="text-xs text-white/40 mb-2 line-clamp-2 pl-4">
                  {task.description}
                </p>
              )}

              {/* Tags */}
              {task.tags && task.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {task.tags.map((tt) => (
                    <span
                      key={tt.tagId}
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: tt.tag.color + "30",
                        color: tt.tag.color,
                        border: `1px solid ${tt.tag.color}55`,
                      }}
                    >
                      {tt.tag.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Project badge */}
              {task.project && (
                <div className="mb-2">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: task.project.color + "40",
                      color: task.project.color,
                    }}
                  >
                    {task.project.name}
                  </span>
                </div>
              )}

              {/* Small Ideas section */}
              <SmallIdeasSection
                task={task}
                parentStatus={task.status}
                onToggle={handleToggleSmallIdea}
                onDelete={handleDeleteSmallIdea}
                onAdd={handleAddSmallIdea}
              />
            </div>

            {/* ── BACK FACE ──────────────────────────────────── */}
            <CardBackFace
              task={task}
              onClose={onUnflip}
              onSaved={onSaved}
              onDeleted={onUnflip}
            />
          </div>
          </div>
        </div>
        );
        // Portal the card to document.body while dragging so it escapes the
        // react-grid-layout transform context (transforms create a new containing
        // block for position:fixed, which breaks dnd's coordinate calculations).
        return snapshot.isDragging
          ? createPortal(card, document.body)
          : card;
      }}
    </Draggable>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({
  column,
  tasks,
  flippedCardId,
  onAddBigIdea,
  onFlipCard,
  onUnflipCard,
  onCardSaved,
}: {
  column: (typeof COLUMNS)[number];
  tasks: Task[];
  flippedCardId: string | null;
  onAddBigIdea: (status: TaskStatus) => void;
  onFlipCard: (taskId: string) => void;
  onUnflipCard: () => void;
  onCardSaved: (updated: Task) => void;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl flex flex-col w-72 flex-shrink-0">
      {/* Column header */}
      <div className="border-b border-gray-800 px-4 py-3 rounded-t-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${column.dotColor} flex-shrink-0`} />
          <span className="font-semibold text-white text-sm">
            {column.label}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAddBigIdea(column.id)}
          className="text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg w-6 h-6 flex items-center justify-center transition-colors text-lg leading-none"
          title={`Add Big Idea to ${column.label}`}
        >
          +
        </button>
      </div>

      {/* Droppable list */}
      <Droppable droppableId={column.id} isCombineEnabled={false}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex flex-col gap-2 flex-1 p-3 overflow-y-auto min-h-[120px] rounded-b-xl transition-colors ${
              snapshot.isDraggingOver ? column.highlightColor : ""
            }`}
          >
            {tasks.map((task, index) => (
              <BigIdeaCard
                key={task.id}
                task={task}
                index={index}
                isFlipped={flippedCardId === task.id}
                onFlip={() => onFlipCard(task.id)}
                onUnflip={onUnflipCard}
                onSaved={onCardSaved}
              />
            ))}
            {provided.placeholder}

            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <p className="text-center text-white/20 text-xs py-6">
                No Big Ideas yet
              </p>
            )}

          </div>
        )}
      </Droppable>
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

interface FilterState {
  priorities: TaskPriority[];
  projectId: string;
  tagIds: string[];
}

function FilterBar({
  filters,
  onChange,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
}) {
  const { projects, tags } = useTaskmasterStore();

  function togglePriority(p: TaskPriority) {
    const next = filters.priorities.includes(p)
      ? filters.priorities.filter((x) => x !== p)
      : [...filters.priorities, p];
    onChange({ ...filters, priorities: next });
  }

  function toggleTag(tagId: string) {
    const next = filters.tagIds.includes(tagId)
      ? filters.tagIds.filter((x) => x !== tagId)
      : [...filters.tagIds, tagId];
    onChange({ ...filters, tagIds: next });
  }

  const priorityStyle: Record<TaskPriority, string> = {
    HIGH:   "border-red-700/50 data-[active=true]:bg-red-900/60 data-[active=true]:text-red-300 data-[active=true]:border-red-700",
    MEDIUM: "border-yellow-700/50 data-[active=true]:bg-yellow-900/60 data-[active=true]:text-yellow-300 data-[active=true]:border-yellow-700",
    LOW:    "border-white/10 data-[active=true]:bg-white/10 data-[active=true]:text-white/80 data-[active=true]:border-white/20",
  };

  const hasFilters =
    filters.priorities.length > 0 ||
    filters.projectId !== "" ||
    filters.tagIds.length > 0;

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      <span className="text-xs text-white/30 font-medium uppercase tracking-wider">
        Filter:
      </span>

      {(["HIGH", "MEDIUM", "LOW"] as TaskPriority[]).map((p) => (
        <button
          key={p}
          data-active={filters.priorities.includes(p)}
          onClick={() => togglePriority(p)}
          className={`text-xs px-3 py-1 rounded-full border text-white/40 transition-colors ${priorityStyle[p]}`}
        >
          {p}
        </button>
      ))}

      {projects.length > 0 && (
        <select
          value={filters.projectId}
          onChange={(e) => onChange({ ...filters, projectId: e.target.value })}
          className="text-xs bg-gray-800 border border-gray-700 rounded-full px-3 py-1 text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      {tags.map((tag) => (
        <button
          key={tag.id}
          onClick={() => toggleTag(tag.id)}
          className="text-xs px-2.5 py-1 rounded-full border transition-all"
          style={{
            backgroundColor: filters.tagIds.includes(tag.id) ? tag.color + "33" : "transparent",
            color: filters.tagIds.includes(tag.id) ? tag.color : "rgba(255,255,255,0.3)",
            borderColor: filters.tagIds.includes(tag.id) ? tag.color + "60" : "rgba(255,255,255,0.1)",
          }}
        >
          {tag.name}
        </button>
      ))}

      {hasFilters && (
        <button
          onClick={() => onChange({ priorities: [], projectId: "", tagIds: [] })}
          className="text-xs text-white/30 hover:text-white underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}

// ─── Main Kanban Board ────────────────────────────────────────────────────────

export default function KanbanBoard() {
  const {
    tasks,
    tasksLoading,
    setTasks,
    setTasksLoading,
    updateTask,
    addTask,
    setProjects,
    setTags,
  } = useTaskmasterStore();

  const [addingToColumn, setAddingToColumn] = useState<TaskStatus | null>(null);
  const [flippedCardId, setFlippedCardId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    priorities: [],
    projectId: "",
    tagIds: [],
  });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const sseRef = useRef<EventSource | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const fetchTasks = useCallback(
    async (cursor?: string) => {
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (cursor) params.set("cursor", cursor);
        const { data } = await axios.get<TasksResponse>(
          `/api/tasks?${params.toString()}`
        );
        if (cursor) {
          setTasks([...tasks, ...data.tasks]);
        } else {
          setTasks(data.tasks);
        }
        setNextCursor(data.nextCursor);
      } catch {
        // silently ignore
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setTasks]
  );

  const fetchProjects = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/projects");
      setProjects(data.projects ?? data);
    } catch {
      // ignore
    }
  }, [setProjects]);

  const fetchTags = useCallback(async () => {
    try {
      const { data } = await axios.get<{ tags: Tag[] }>("/api/tags");
      setTags(data.tags ?? []);
    } catch {
      // ignore
    }
  }, [setTags]);

  useEffect(() => {
    setTasksLoading(true);
    Promise.all([fetchTasks(), fetchProjects(), fetchTags()]).finally(() =>
      setTasksLoading(false)
    );

    const es = new EventSource("/api/events");
    sseRef.current = es;
    es.addEventListener("ping", () => {
      fetchTasks();
    });
    es.onerror = () => { es.close(); };

    return () => { es.close(); };
  }, [fetchTasks, fetchProjects, fetchTags, setTasksLoading]);

  // Clicking on the board background closes any open card flip
  function handleBoardClick(e: React.MouseEvent<HTMLDivElement>) {
    if (flippedCardId && e.target === boardRef.current) {
      setFlippedCardId(null);
    }
  }

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    await fetchTasks(nextCursor);
    setLoadingMore(false);
  }

  async function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    )
      return;

    const newStatus = destination.droppableId as TaskStatus;
    const oldStatus = source.droppableId as TaskStatus;

    if (newStatus === oldStatus) {
      // Reorder within the same column — splice in the store array
      const colTasks = tasksByStatus[newStatus];
      const movedId = colTasks[source.index].id;
      const targetId = colTasks[destination.index].id;
      const newTasks = [...tasks];
      const fromIdx = newTasks.findIndex((t) => t.id === movedId);
      const toIdx = newTasks.findIndex((t) => t.id === targetId);
      const [item] = newTasks.splice(fromIdx, 1);
      newTasks.splice(toIdx, 0, item);
      setTasks(newTasks);
      // Persist order for all top-level tasks in this column (fire-and-forget)
      const colOrdered = newTasks.filter((t) => t.status === newStatus && !t.parentTaskId);
      colOrdered.forEach((t, i) => {
        axios.put(`/api/tasks/${t.id}`, { order: i + 1 }).catch(() => {});
      });
      return;
    }

    updateTask(draggableId, { status: newStatus });

    try {
      await axios.put(`/api/tasks/${draggableId}`, { status: newStatus });
    } catch {
      updateTask(draggableId, { status: oldStatus });
      toast.error("Failed to update Big Idea status");
    }
  }

  // Only show top-level tasks (Big Ideas); Small Ideas are nested inside cards
  const filteredTasks = tasks.filter((t) => {
    if (t.parentTaskId !== null) return false;
    if (filters.priorities.length > 0 && !filters.priorities.includes(t.priority))
      return false;
    if (filters.projectId && t.projectId !== filters.projectId) return false;
    if (filters.tagIds.length > 0) {
      const taskTagIds = (t.tags ?? []).map((tt) => tt.tagId);
      const hasAny = filters.tagIds.some((id) => taskTagIds.includes(id));
      if (!hasAny) return false;
    }
    return true;
  });

  const tasksByStatus = COLUMNS.reduce<Record<TaskStatus, Task[]>>(
    (acc, col) => {
      acc[col.id] = filteredTasks.filter((t) => t.status === col.id);
      return acc;
    },
    { BACKLOG: [], WILD_IDEA: [], TODO: [], IN_PROGRESS: [], DONE: [], WONT_DO: [] }
  );

  if (tasksLoading) return <KanbanSkeleton />;

  return (
    <>
      <FilterBar filters={filters} onChange={setFilters} />

      <DragDropContext onDragEnd={handleDragEnd}>
        <div
          ref={boardRef}
          className="flex flex-row gap-4 overflow-x-auto pb-4"
          onClick={handleBoardClick}
        >
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              tasks={tasksByStatus[col.id]}
              flippedCardId={flippedCardId}
              onAddBigIdea={(status) => setAddingToColumn(status)}
              onFlipCard={(id) => setFlippedCardId(id)}
              onUnflipCard={() => setFlippedCardId(null)}
              onCardSaved={(updated) => updateTask(updated.id, updated)}
            />
          ))}
        </div>
      </DragDropContext>

      {nextCursor && (
        <div className="flex justify-center pt-4">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="text-sm text-white/40 hover:text-white disabled:opacity-50 underline"
          >
            {loadingMore ? "Loading…" : "Load more Big Ideas"}
          </button>
        </div>
      )}

      {addingToColumn && (
        <BigIdeaModal
          mode="create"
          defaultStatus={addingToColumn}
          onClose={() => setAddingToColumn(null)}
          onSaved={(task) => addTask(task)}
        />
      )}
    </>
  );
}
