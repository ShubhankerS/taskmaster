// FILE: ~/taskmaster/src/lib/store.test.ts
// Unit tests for the Zustand store actions.

import { describe, it, expect, beforeEach } from "vitest";
import { useTaskmasterStore } from "./store";
import type { Task, Project, Note, TimeLog } from "./store";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Test Task",
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    dueDate: null,
    recurrence: null,
    projectId: null,
    project: null,
    parentTaskId: null,
    subtasks: [],
    _count: { subtasks: 0 },
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    name: "Test Project",
    description: null,
    color: "#6366f1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    title: "Test Note",
    content: "Hello world",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeTimeLog(overrides: Partial<TimeLog> = {}): TimeLog {
  return {
    id: "log-1",
    description: null,
    startTime: new Date().toISOString(),
    endTime: null,
    duration: null,
    taskId: "task-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Reset store between tests
beforeEach(() => {
  useTaskmasterStore.setState({
    tasks: [],
    tasksLoading: false,
    projects: [],
    projectsLoading: false,
    timeLogs: [],
    timeLogsLoading: false,
    activeTimer: null,
    notes: [],
    notesLoading: false,
    activeNoteId: null,
  });
});

// ─── Task tests ───────────────────────────────────────────────────────────────

describe("task store actions", () => {
  it("addTask prepends the task to the list", () => {
    const task = makeTask();
    useTaskmasterStore.getState().addTask(task);
    expect(useTaskmasterStore.getState().tasks).toHaveLength(1);
    expect(useTaskmasterStore.getState().tasks[0].id).toBe("task-1");
  });

  it("setTasks replaces the list", () => {
    useTaskmasterStore.getState().addTask(makeTask({ id: "old" }));
    useTaskmasterStore.getState().setTasks([makeTask({ id: "new-1" }), makeTask({ id: "new-2" })]);
    const ids = useTaskmasterStore.getState().tasks.map((t) => t.id);
    expect(ids).toEqual(["new-1", "new-2"]);
  });

  it("updateTask merges partial fields", () => {
    useTaskmasterStore.getState().addTask(makeTask());
    useTaskmasterStore.getState().updateTask("task-1", { status: "DONE", title: "Updated" });
    const task = useTaskmasterStore.getState().tasks[0];
    expect(task.status).toBe("DONE");
    expect(task.title).toBe("Updated");
    expect(task.priority).toBe("MEDIUM"); // unchanged
  });

  it("removeTask deletes the correct task", () => {
    useTaskmasterStore.getState().addTask(makeTask({ id: "a" }));
    useTaskmasterStore.getState().addTask(makeTask({ id: "b" }));
    useTaskmasterStore.getState().removeTask("a");
    const ids = useTaskmasterStore.getState().tasks.map((t) => t.id);
    expect(ids).toEqual(["b"]);
  });

  it("setTasksLoading toggles the flag", () => {
    useTaskmasterStore.getState().setTasksLoading(true);
    expect(useTaskmasterStore.getState().tasksLoading).toBe(true);
    useTaskmasterStore.getState().setTasksLoading(false);
    expect(useTaskmasterStore.getState().tasksLoading).toBe(false);
  });
});

// ─── Project tests ────────────────────────────────────────────────────────────

describe("project store actions", () => {
  it("addProject prepends to the list", () => {
    useTaskmasterStore.getState().addProject(makeProject());
    expect(useTaskmasterStore.getState().projects).toHaveLength(1);
  });

  it("removeProject removes by id", () => {
    useTaskmasterStore.getState().addProject(makeProject({ id: "p1" }));
    useTaskmasterStore.getState().addProject(makeProject({ id: "p2" }));
    useTaskmasterStore.getState().removeProject("p1");
    const ids = useTaskmasterStore.getState().projects.map((p) => p.id);
    expect(ids).toEqual(["p2"]);
  });

  it("updateProject patches specific fields", () => {
    useTaskmasterStore.getState().addProject(makeProject());
    useTaskmasterStore.getState().updateProject("proj-1", { name: "Renamed" });
    expect(useTaskmasterStore.getState().projects[0].name).toBe("Renamed");
    expect(useTaskmasterStore.getState().projects[0].color).toBe("#6366f1");
  });
});

// ─── Note tests ───────────────────────────────────────────────────────────────

describe("note store actions", () => {
  it("addNote prepends to the list", () => {
    useTaskmasterStore.getState().addNote(makeNote());
    expect(useTaskmasterStore.getState().notes).toHaveLength(1);
  });

  it("removeNote removes the correct note", () => {
    useTaskmasterStore.getState().addNote(makeNote({ id: "n1" }));
    useTaskmasterStore.getState().addNote(makeNote({ id: "n2" }));
    useTaskmasterStore.getState().removeNote("n1");
    expect(useTaskmasterStore.getState().notes.map((n) => n.id)).toEqual(["n2"]);
  });

  it("setActiveNoteId sets and clears the active note", () => {
    useTaskmasterStore.getState().setActiveNoteId("n1");
    expect(useTaskmasterStore.getState().activeNoteId).toBe("n1");
    useTaskmasterStore.getState().setActiveNoteId(null);
    expect(useTaskmasterStore.getState().activeNoteId).toBeNull();
  });
});

// ─── Time log tests ───────────────────────────────────────────────────────────

describe("time log store actions", () => {
  it("addTimeLog prepends the log", () => {
    useTaskmasterStore.getState().addTimeLog(makeTimeLog({ id: "l1" }));
    expect(useTaskmasterStore.getState().timeLogs).toHaveLength(1);
  });

  it("removeTimeLog removes by id", () => {
    useTaskmasterStore.getState().addTimeLog(makeTimeLog({ id: "l1" }));
    useTaskmasterStore.getState().addTimeLog(makeTimeLog({ id: "l2" }));
    useTaskmasterStore.getState().removeTimeLog("l1");
    expect(useTaskmasterStore.getState().timeLogs.map((l) => l.id)).toEqual(["l2"]);
  });
});

// ─── Active timer tests ───────────────────────────────────────────────────────

describe("active timer", () => {
  it("tickTimer increments elapsed seconds", () => {
    useTaskmasterStore.getState().setActiveTimer({
      taskId: "t1",
      taskTitle: "Task",
      startTime: new Date(),
      elapsedSeconds: 0,
    });
    useTaskmasterStore.getState().tickTimer();
    useTaskmasterStore.getState().tickTimer();
    expect(useTaskmasterStore.getState().activeTimer?.elapsedSeconds).toBe(2);
  });

  it("tickTimer is a no-op when no active timer", () => {
    useTaskmasterStore.getState().tickTimer();
    expect(useTaskmasterStore.getState().activeTimer).toBeNull();
  });

  it("setActiveTimer(null) clears the timer", () => {
    useTaskmasterStore.getState().setActiveTimer({
      taskId: "t1",
      taskTitle: "Task",
      startTime: new Date(),
      elapsedSeconds: 5,
    });
    useTaskmasterStore.getState().setActiveTimer(null);
    expect(useTaskmasterStore.getState().activeTimer).toBeNull();
  });
});
