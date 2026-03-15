// FILE: ~/taskmaster/src/components/NotesView.tsx
// Notes list and in-place markdown editor component.

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import { useTaskmasterStore, type Note } from "@/lib/store";

// Dynamically import the MD editor to avoid SSR issues (it uses browser APIs)
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

// ─── API response shape ───────────────────────────────────────────────────────

interface NotesResponse {
  notes: Note[];
  nextCursor: string | null;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function NotesSidebarSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="px-4 py-3 border-b border-gray-800/50 animate-pulse"
        >
          <div className="w-3/4 h-4 bg-gray-700 rounded mb-1.5" />
          <div className="w-full h-3 bg-gray-700 rounded mb-1" />
          <div className="w-16 h-3 bg-gray-700 rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Note Editor ──────────────────────────────────────────────────────────────

type EditorMode = "edit" | "preview" | "split";

function NoteEditor({
  note,
  onSaved,
}: {
  note: Note;
  onSaved: (n: Note) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("split");

  // Auto-save with debounce (1.5 s)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (newTitle: string, newContent: string) => {
      if (!newTitle.trim()) return;
      setSaving(true);
      try {
        const { data } = await axios.put<Note>(`/api/notes/${note.id}`, {
          title: newTitle.trim(),
          content: newContent,
        });
        onSaved(data);
        setLastSaved(new Date());
      } catch {
        // silently skip auto-save errors
      } finally {
        setSaving(false);
      }
    },
    [note.id, onSaved]
  );

  function handleTitleChange(value: string) {
    setTitle(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(value, content), 1500);
  }

  function handleContentChange(value: string | undefined) {
    const val = value ?? "";
    setContent(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(title, val), 1500);
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Editor toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800">
        {/* Mode toggles */}
        <div className="flex rounded-lg border border-gray-700 overflow-hidden text-xs">
          {(["edit", "split", "preview"] as EditorMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setEditorMode(m)}
              className={`px-3 py-1 transition-colors capitalize ${
                editorMode === m
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="ml-auto">
          {saving && (
            <span className="text-xs text-gray-500">Saving…</span>
          )}
          {!saving && lastSaved && (
            <span className="text-xs text-gray-600">
              Saved{" "}
              {lastSaved.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="px-6 pt-5 pb-3">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Note title"
          className="w-full bg-transparent text-2xl font-bold text-white placeholder-gray-600 focus:outline-none"
        />
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden px-6 pb-6" data-color-mode="dark">
        {editorMode === "preview" ? (
          <div className="h-full overflow-y-auto prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : editorMode === "edit" ? (
          <MDEditor
            value={content}
            onChange={handleContentChange}
            preview="edit"
            height="100%"
            style={{ background: "transparent" }}
            visibleDragbar={false}
          />
        ) : (
          <MDEditor
            value={content}
            onChange={handleContentChange}
            preview="live"
            height="100%"
            style={{ background: "transparent" }}
            visibleDragbar={false}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main NotesView ───────────────────────────────────────────────────────────

export default function NotesView() {
  const {
    notes,
    notesLoading,
    setNotes,
    setNotesLoading,
    addNote,
    updateNote,
    removeNote,
    activeNoteId,
    setActiveNoteId,
  } = useTaskmasterStore();

  const [creating, setCreating] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  const fetchNotes = useCallback(
    async (cursor?: string) => {
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (cursor) params.set("cursor", cursor);
        const { data } = await axios.get<NotesResponse>(
          `/api/notes?${params.toString()}`
        );
        if (cursor) {
          setNotes([...notes, ...(data.notes ?? [])]);
        } else {
          setNotes(data.notes ?? []);
        }
        setNextCursor(data.nextCursor);
      } catch {
        // ignore polling errors
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setNotes]
  );

  useEffect(() => {
    setNotesLoading(true);
    fetchNotes().finally(() => setNotesLoading(false));

    const es = new EventSource("/api/events");
    sseRef.current = es;
    es.addEventListener("ping", () => fetchNotes());
    es.onerror = () => es.close();

    return () => es.close();
  }, [fetchNotes, setNotesLoading]);

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    await fetchNotes(nextCursor);
    setLoadingMore(false);
  }

  async function handleCreateNote() {
    setCreating(true);
    try {
      const { data } = await axios.post<Note>("/api/notes", {
        title: "Untitled Note",
        content: "",
      });
      addNote(data);
      setActiveNoteId(data.id);
      toast.success("Note created");
    } catch {
      toast.error("Failed to create note");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteNote(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const note = notes.find((n) => n.id === id);
    const toastId = toast.loading("Deleting note…");
    try {
      await axios.delete(`/api/notes/${id}`);
      removeNote(id);
      if (activeNoteId === id) {
        const remaining = notes.filter((n) => n.id !== id);
        setActiveNoteId(remaining[0]?.id ?? null);
      }
      toast.success(`"${note?.title ?? "Note"}" deleted`, { id: toastId });
    } catch {
      toast.error("Failed to delete note", { id: toastId });
    }
  }

  const activeNote = notes.find((n) => n.id === activeNoteId);

  return (
    <div className="flex h-full">
      {/* ── Sidebar: notes list ───────────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 border-r border-gray-800 flex flex-col bg-gray-900/50">
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
          <h1 className="text-base font-bold text-white">Notes</h1>
          <button
            onClick={handleCreateNote}
            disabled={creating}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            {creating ? "…" : "+ New"}
          </button>
        </div>

        {notesLoading ? (
          <NotesSidebarSkeleton />
        ) : notes.length === 0 ? (
          <div className="flex-1 text-center py-12 px-4">
            <p className="text-gray-500 text-sm">No notes yet</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {notes.map((note) => (
              <button
                key={note.id}
                onClick={() => setActiveNoteId(note.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-800/50 hover:bg-gray-800 transition-colors group relative ${
                  activeNoteId === note.id ? "bg-gray-800" : ""
                }`}
              >
                <p className="text-sm font-medium text-white truncate pr-6">
                  {note.title || "Untitled Note"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {note.content
                    ? note.content.replace(/[#*`\[\]]/g, "").slice(0, 50)
                    : "Empty note"}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {new Date(note.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <button
                  onClick={(e) => handleDeleteNote(note.id, e)}
                  className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity text-xs"
                >
                  ✕
                </button>
              </button>
            ))}

            {nextCursor && (
              <div className="p-3 border-t border-gray-800 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="text-xs text-gray-400 hover:text-white disabled:opacity-50 underline"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* ── Editor pane ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {activeNote ? (
          <NoteEditor
            key={activeNote.id}
            note={activeNote}
            onSaved={(updated) => updateNote(updated.id, updated)}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-5xl mb-4">📝</div>
              <h3 className="text-lg font-medium text-white mb-1">
                {notes.length === 0 ? "No notes yet" : "Select a note"}
              </h3>
              <p className="text-gray-400 text-sm mb-6">
                {notes.length === 0
                  ? "Create your first note to get started."
                  : "Choose a note from the sidebar or create a new one."}
              </p>
              <button
                onClick={handleCreateNote}
                disabled={creating}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-xl transition-colors"
              >
                New Note
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
