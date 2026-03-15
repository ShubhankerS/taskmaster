// FILE: ~/taskmaster/src/components/GlobalSearch.tsx
// Global search input that searches across tasks, projects, and notes
// using client-side filtering against the Zustand store.

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTaskmasterStore } from "@/lib/store";

interface SearchResult {
  type: "task" | "project" | "note";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-indigo-500/40 text-white rounded">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { tasks, projects, notes } = useTaskmasterStore();

  const getResults = useCallback((): SearchResult[] => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();

    const taskResults: SearchResult[] = tasks
      .filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 5)
      .map((t) => ({
        type: "task",
        id: t.id,
        title: t.title,
        subtitle: t.project?.name ?? t.status,
        href: "/dashboard",
      }));

    const projectResults: SearchResult[] = projects
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 3)
      .map((p) => ({
        type: "project",
        id: p.id,
        title: p.name,
        subtitle: p.description ?? undefined,
        href: `/dashboard/projects/${p.id}`,
      }));

    const noteResults: SearchResult[] = notes
      .filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q)
      )
      .slice(0, 3)
      .map((n) => ({
        type: "note",
        id: n.id,
        title: n.title,
        subtitle: n.content.replace(/[#*`\[\]]/g, "").slice(0, 60) || undefined,
        href: "/dashboard/notes",
      }));

    return [...taskResults, ...projectResults, ...noteResults];
  }, [query, tasks, projects, notes]);

  const results = getResults();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(result: SearchResult) {
    setQuery("");
    setOpen(false);
    router.push(result.href);
  }

  const typeIcons: Record<string, string> = {
    task: "☑",
    project: "◈",
    note: "✎",
  };

  const typeLabels: Record<string, string> = {
    task: "Tasks",
    project: "Projects",
    note: "Notes",
  };

  // Group results by type for display
  const grouped = results.reduce<Record<string, SearchResult[]>>(
    (acc, r) => {
      if (!acc[r.type]) acc[r.type] = [];
      acc[r.type].push(r);
      return acc;
    },
    {}
  );

  return (
    <div ref={containerRef} className="relative px-3 py-3">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs select-none">
          🔍
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search…"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-7 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors text-sm leading-none"
          >
            ×
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div className="absolute bottom-full left-3 right-3 mb-1 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl overflow-hidden z-50 max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4 px-3">
              No results for &quot;{query}&quot;
            </p>
          ) : (
            Object.entries(grouped).map(([type, items]) => (
              <div key={type}>
                <div className="px-3 py-1.5 bg-gray-700/50 border-b border-gray-700">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {typeLabels[type] ?? type}
                  </span>
                </div>
                {items.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleSelect(r)}
                    className="w-full text-left flex items-start gap-3 px-3 py-2.5 hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-base mt-0.5 flex-shrink-0 text-gray-400">
                      {typeIcons[r.type]}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">
                        {highlight(r.title, query)}
                      </p>
                      {r.subtitle && (
                        <p className="text-xs text-gray-400 truncate">
                          {r.subtitle}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
