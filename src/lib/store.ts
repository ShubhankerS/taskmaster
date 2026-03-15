// FILE: ~/taskmaster/src/lib/store.ts
// Zustand store — client-side state for tasks, projects, time tracking, notes, and tags.

import { create } from "zustand";

// ─── Domain Types ─────────────────────────────────────────────────────────────

export type TaskStatus = "BACKLOG" | "WILD_IDEA" | "TODO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";
export type RecurrenceType = "daily" | "weekly" | "monthly" | null;

export interface Tag {
  id: string;
  name: string;
  color: string;
  userId: string;
  createdAt: string;
  _count?: { tasks: number };
}

export interface TaskTag {
  tagId: string;
  taskId: string;
  tag: Tag;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
  _count?: { tasks: number };
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  recurrence: RecurrenceType;
  projectId: string | null;
  project: Pick<Project, "id" | "name" | "color"> | null;
  parentTaskId: string | null;
  subtasks?: Task[];
  _count?: { subtasks: number };
  tags?: TaskTag[];
  createdAt: string;
  updatedAt: string;
}

export interface TimeLog {
  id: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  duration: number | null; // seconds
  taskId: string;
  task?: Pick<Task, "id" | "title">;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Active Timer State ───────────────────────────────────────────────────────

export interface ActiveTimer {
  taskId: string;
  taskTitle: string;
  startTime: Date;
  elapsedSeconds: number;
}

// ─── Store Shape ──────────────────────────────────────────────────────────────

interface TaskmasterState {
  // Tasks
  tasks: Task[];
  tasksLoading: boolean;
  setTasks: (tasks: Task[]) => void;
  setTasksLoading: (loading: boolean) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;

  // Projects
  projects: Project[];
  projectsLoading: boolean;
  setProjects: (projects: Project[]) => void;
  setProjectsLoading: (loading: boolean) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;

  // Time Logs
  timeLogs: TimeLog[];
  timeLogsLoading: boolean;
  setTimeLogs: (timeLogs: TimeLog[]) => void;
  setTimeLogsLoading: (loading: boolean) => void;
  addTimeLog: (timeLog: TimeLog) => void;
  updateTimeLog: (id: string, updates: Partial<TimeLog>) => void;
  removeTimeLog: (id: string) => void;

  // Active timer (client-side only — not persisted to DB until stopped)
  activeTimer: ActiveTimer | null;
  setActiveTimer: (timer: ActiveTimer | null) => void;
  tickTimer: () => void;

  // Notes
  notes: Note[];
  notesLoading: boolean;
  setNotes: (notes: Note[]) => void;
  setNotesLoading: (loading: boolean) => void;
  addNote: (note: Note) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  removeNote: (id: string) => void;

  // Active note being edited
  activeNoteId: string | null;
  setActiveNoteId: (id: string | null) => void;

  // Tags
  tags: Tag[];
  tagsLoading: boolean;
  setTags: (tags: Tag[]) => void;
  setTagsLoading: (loading: boolean) => void;
  addTag: (tag: Tag) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  removeTag: (id: string) => void;
}

// ─── Store Implementation ─────────────────────────────────────────────────────

export const useTaskmasterStore = create<TaskmasterState>((set) => ({
  // ── Tasks ──────────────────────────────────────────────────────────────────
  tasks: [],
  tasksLoading: false,
  setTasks: (tasks) => set({ tasks }),
  setTasksLoading: (loading) => set({ tasksLoading: loading }),
  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeTask: (id) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

  // ── Projects ───────────────────────────────────────────────────────────────
  projects: [],
  projectsLoading: false,
  setProjects: (projects) => set({ projects }),
  setProjectsLoading: (loading) => set({ projectsLoading: loading }),
  addProject: (project) =>
    set((state) => ({ projects: [project, ...state.projects] })),
  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),
  removeProject: (id) =>
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) })),

  // ── Time Logs ──────────────────────────────────────────────────────────────
  timeLogs: [],
  timeLogsLoading: false,
  setTimeLogs: (timeLogs) => set({ timeLogs }),
  setTimeLogsLoading: (loading) => set({ timeLogsLoading: loading }),
  addTimeLog: (timeLog) =>
    set((state) => ({ timeLogs: [timeLog, ...state.timeLogs] })),
  updateTimeLog: (id, updates) =>
    set((state) => ({
      timeLogs: state.timeLogs.map((tl) =>
        tl.id === id ? { ...tl, ...updates } : tl
      ),
    })),
  removeTimeLog: (id) =>
    set((state) => ({
      timeLogs: state.timeLogs.filter((tl) => tl.id !== id),
    })),

  // ── Active Timer ───────────────────────────────────────────────────────────
  activeTimer: null,
  setActiveTimer: (timer) => set({ activeTimer: timer }),
  tickTimer: () =>
    set((state) => {
      if (!state.activeTimer) return state;
      return {
        activeTimer: {
          ...state.activeTimer,
          elapsedSeconds: state.activeTimer.elapsedSeconds + 1,
        },
      };
    }),

  // ── Notes ──────────────────────────────────────────────────────────────────
  notes: [],
  notesLoading: false,
  setNotes: (notes) => set({ notes }),
  setNotesLoading: (loading) => set({ notesLoading: loading }),
  addNote: (note) => set((state) => ({ notes: [note, ...state.notes] })),
  updateNote: (id, updates) =>
    set((state) => ({
      notes: state.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),
  removeNote: (id) =>
    set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })),

  // ── Active Note ────────────────────────────────────────────────────────────
  activeNoteId: null,
  setActiveNoteId: (id) => set({ activeNoteId: id }),

  // ── Tags ───────────────────────────────────────────────────────────────────
  tags: [],
  tagsLoading: false,
  setTags: (tags) => set({ tags }),
  setTagsLoading: (loading) => set({ tagsLoading: loading }),
  addTag: (tag) => set((state) => ({ tags: [tag, ...state.tags] })),
  updateTag: (id, updates) =>
    set((state) => ({
      tags: state.tags.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeTag: (id) =>
    set((state) => ({ tags: state.tags.filter((t) => t.id !== id) })),
}));
