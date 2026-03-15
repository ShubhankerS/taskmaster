// FILE: ~/taskmaster/src/app/dashboard/tags/page.tsx
// Tag management page — list, create, rename, recolor, delete tags.
// Clicking a tag shows all Big Ideas with that tag.

"use client";

import { useEffect, useCallback, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useTaskmasterStore, type Tag, type Task, type TaskTag } from "@/lib/store";

const TAG_PALETTE = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#14b8a6",
];

// ─── Tag form (create / edit) ─────────────────────────────────────────────────

function TagForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: Tag;
  onSaved: (tag: Tag) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? TAG_PALETTE[0]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const payload = { name: name.trim(), color };
      const { data } = initial
        ? await axios.put<Tag>(`/api/tags/${initial.id}`, payload)
        : await axios.post<Tag>("/api/tags", payload);
      onSaved(data);
      if (!initial) setName("");
      toast.success(initial ? "Tag updated" : "Tag created");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.fields?.name) {
        toast.error(err.response.data.fields.name[0]);
      } else {
        toast.error("Failed to save tag");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3 flex-wrap">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tag name…"
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-40"
      />
      <div className="flex gap-1.5">
        {TAG_PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={`w-6 h-6 rounded-full transition-transform ${
              color === c
                ? "scale-125 ring-2 ring-white ring-offset-2 ring-offset-gray-950"
                : "hover:scale-110"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <button
        type="submit"
        disabled={submitting || !name.trim()}
        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
      >
        {submitting ? "…" : initial ? "Save" : "Create Tag"}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors"
        >
          Cancel
        </button>
      )}
    </form>
  );
}

// ─── Tag row ──────────────────────────────────────────────────────────────────

function TagRow({
  tag,
  isSelected,
  onSelect,
  onUpdated,
  onDeleted,
}: {
  tag: Tag & { _count?: { tasks: number } };
  isSelected: boolean;
  onSelect: () => void;
  onUpdated: (t: Tag) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const toastId = toast.loading("Deleting tag…");
    try {
      await axios.delete(`/api/tags/${tag.id}`);
      onDeleted(tag.id);
      toast.success("Tag deleted", { id: toastId });
    } catch {
      toast.error("Failed to delete tag", { id: toastId });
      setDeleting(false);
    }
  }

  const taskCount = tag._count?.tasks ?? 0;

  if (editing) {
    return (
      <div className="bg-gray-900 border border-indigo-700 rounded-2xl px-5 py-4">
        <TagForm
          initial={tag}
          onSaved={(updated) => {
            onUpdated(updated);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div
      className={`bg-gray-900 border rounded-2xl px-5 py-4 flex items-center gap-4 group transition-colors cursor-pointer ${
        isSelected
          ? "border-indigo-600"
          : "border-gray-800 hover:border-gray-700"
      }`}
      onClick={onSelect}
    >
      {/* Color dot */}
      <div
        className="w-4 h-4 rounded-full flex-shrink-0"
        style={{ backgroundColor: tag.color }}
      />

      {/* Name + preview pill */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium text-sm">{tag.name}</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: tag.color + "25",
              color: tag.color,
              border: `1px solid ${tag.color}50`,
            }}
          >
            {tag.name}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {taskCount} Big {taskCount === 1 ? "Idea" : "Ideas"}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          className="text-gray-400 hover:text-indigo-400 text-xs px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors"
        >
          Rename
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleDelete(); }}
          disabled={deleting}
          className="text-gray-500 hover:text-red-400 text-xs px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── Filtered Big Ideas list ──────────────────────────────────────────────────

function BigIdeasForTag({ tag }: { tag: Tag }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios
      .get<{ tasks: Task[] }>("/api/tasks?limit=100")
      .then(({ data }) => {
        const filtered = (data.tasks ?? []).filter((t) =>
          (t.tags ?? []).some((tt: TaskTag) => tt.tagId === tag.id)
        );
        setTasks(filtered);
      })
      .catch(() => { /* ignore */ })
      .finally(() => setLoading(false));
  }, [tag.id]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-2 mt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-gray-800 rounded-xl" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <p className="text-gray-500 text-sm text-center py-8 mt-4">
        No Big Ideas with this tag yet.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-3"
        >
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
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
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
              task.priority === "HIGH"
                ? "bg-red-900 text-red-300"
                : task.priority === "MEDIUM"
                ? "bg-yellow-900 text-yellow-300"
                : "bg-gray-700 text-gray-300"
            }`}
          >
            {task.priority}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Tags Page ───────────────────────────────────────────────────────────

export default function TagsPage() {
  const { tags, setTags, tagsLoading, setTagsLoading, addTag, updateTag, removeTag } =
    useTaskmasterStore();
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    try {
      const { data } = await axios.get<{ tags: Tag[] }>("/api/tags");
      setTags(data.tags ?? []);
    } catch {
      // ignore
    }
  }, [setTags]);

  useEffect(() => {
    setTagsLoading(true);
    fetchTags().finally(() => setTagsLoading(false));

    const es = new EventSource("/api/events");
    es.addEventListener("ping", () => fetchTags());
    es.onerror = () => es.close();
    return () => es.close();
  }, [fetchTags, setTagsLoading]);

  const selectedTag = tags.find((t) => t.id === selectedTagId);

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Tags</h1>
        <p className="text-gray-400 mt-1">
          Organize your Big Ideas with colored tags.
        </p>
      </div>

      {/* Create tag form */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          Create Tag
        </h2>
        <TagForm
          onSaved={(tag) => {
            addTag(tag);
            setSelectedTagId(tag.id);
          }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Tags list */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            All Tags ({tags.length})
          </h2>

          {tagsLoading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-800 rounded-2xl" />
              ))}
            </div>
          ) : tags.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🏷️</div>
              <p className="text-gray-400 text-sm">No tags yet.</p>
              <p className="text-gray-600 text-xs mt-1">
                Create a tag above to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tags.map((tag) => (
                <TagRow
                  key={tag.id}
                  tag={tag}
                  isSelected={selectedTagId === tag.id}
                  onSelect={() =>
                    setSelectedTagId(selectedTagId === tag.id ? null : tag.id)
                  }
                  onUpdated={(updated) => updateTag(updated.id, updated)}
                  onDeleted={(id) => {
                    removeTag(id);
                    if (selectedTagId === id) setSelectedTagId(null);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Big Ideas for selected tag */}
        <div className="lg:col-span-3">
          {selectedTag ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  Big Ideas tagged
                </h2>
                <span
                  className="text-sm px-3 py-1 rounded-full font-medium"
                  style={{
                    backgroundColor: selectedTag.color + "25",
                    color: selectedTag.color,
                    border: `1px solid ${selectedTag.color}50`,
                  }}
                >
                  {selectedTag.name}
                </span>
              </div>
              <BigIdeasForTag tag={selectedTag} />
            </>
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="text-gray-600 text-sm">
                Select a tag to see its Big Ideas
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
