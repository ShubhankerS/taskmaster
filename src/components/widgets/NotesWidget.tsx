// FILE: ~/taskmaster/src/components/widgets/NotesWidget.tsx
// Recent Notes widget — last 5 notes as clickable cards.

"use client";

import { useEffect, useCallback } from "react";
import axios from "axios";
import Link from "next/link";
import { useTaskmasterStore, type Note } from "@/lib/store";

export default function NotesWidget() {
  const { notes, setNotes, setActiveNoteId } = useTaskmasterStore();

  const fetchNotes = useCallback(async () => {
    try {
      const { data } = await axios.get<{ notes: Note[] }>("/api/notes?limit=10");
      setNotes(data.notes ?? []);
    } catch { /* ignore */ }
  }, [setNotes]);

  useEffect(() => {
    fetchNotes();
    const interval = setInterval(fetchNotes, 5000);
    return () => clearInterval(interval);
  }, [fetchNotes]);

  const recent = notes.slice(0, 5);

  return (
    <div className="p-4 h-full overflow-y-auto flex flex-col gap-2">
      {recent.length === 0 ? (
        <p className="text-gray-600 text-xs text-center py-6">No notes yet</p>
      ) : (
        recent.map((note) => (
          <Link
            key={note.id}
            href="/dashboard/notes"
            onClick={() => setActiveNoteId(note.id)}
            className="block bg-gray-800 rounded-lg p-3 hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <p className="text-sm font-medium text-white truncate">
              {note.title || "Untitled Note"}
            </p>
            <p className="text-xs text-gray-400 truncate mt-0.5 line-clamp-1">
              {note.content
                ? note.content.replace(/[#*`\[\]]/g, "").slice(0, 60)
                : "Empty note"}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {new Date(note.updatedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </p>
          </Link>
        ))
      )}

      <Link
        href="/dashboard/notes"
        className="text-xs text-indigo-400 hover:text-indigo-300 text-center mt-auto pt-2 transition-colors"
      >
        View all notes →
      </Link>
    </div>
  );
}
