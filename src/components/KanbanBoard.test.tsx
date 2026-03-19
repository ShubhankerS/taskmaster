// FILE: ~/taskmaster/src/components/KanbanBoard.test.tsx
// Unit tests for KanbanBoard rendering and task display.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useTaskmasterStore } from "@/lib/store";
import type { Task } from "@/lib/store";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
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
    tags: [],
    _count: { subtasks: 0 },
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Use vi.hoisted so axiosMock is available inside the vi.mock factory
const axiosMock = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue({ data: { tasks: [], nextCursor: null } }),
  put: vi.fn().mockResolvedValue({ data: {} }),
  delete: vi.fn().mockResolvedValue({ data: {} }),
  isAxiosError: vi.fn().mockReturnValue(false),
}));

vi.mock("axios", () => ({ default: axiosMock }));

vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Droppable: ({
    children,
    droppableId,
  }: {
    children: (p: object, s: object) => React.ReactNode;
    droppableId: string;
  }) => (
    <div data-testid={`drop-${droppableId}`}>
      {children({ innerRef: vi.fn(), droppableProps: {}, placeholder: null }, {
        isDraggingOver: false,
      })}
    </div>
  ),
  Draggable: ({
    children,
    draggableId,
  }: {
    children: (p: object, s: object) => React.ReactNode;
    draggableId: string;
  }) => (
    <div data-testid={`drag-${draggableId}`}>
      {children(
        { innerRef: vi.fn(), draggableProps: {}, dragHandleProps: {} },
        { isDragging: false }
      )}
    </div>
  ),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn().mockReturnValue("id"),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import KanbanBoard from "./KanbanBoard";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("KanbanBoard", () => {
  beforeEach(() => {
    // Return the already-set store state so async fetch doesn't overwrite it
    axiosMock.get.mockResolvedValue({
      data: {
        tasks: useTaskmasterStore.getState().tasks,
        nextCursor: null,
      },
    });

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

  it("renders three kanban columns", async () => {
    await act(async () => {
      render(<KanbanBoard />);
    });
    expect(screen.getByText("To Do")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("shows 'No Big Ideas yet' when columns are empty", async () => {
    await act(async () => {
      render(<KanbanBoard />);
    });
    const empty = screen.getAllByText("No Big Ideas yet");
    expect(empty.length).toBe(3);
  });

  it("renders task cards already in the store", async () => {
    const tasks = [
      makeTask({ id: "t1", title: "Alpha Task", status: "TODO" }),
      makeTask({ id: "t2", title: "Beta Task", status: "IN_PROGRESS" }),
      makeTask({ id: "t3", title: "Gamma Task", status: "DONE" }),
    ];
    // Set tasks BEFORE rendering; mock axios to return those same tasks
    axiosMock.get.mockResolvedValue({
      data: { tasks, nextCursor: null },
    });
    useTaskmasterStore.setState({ tasks });

    await act(async () => {
      render(<KanbanBoard />);
    });

    expect(screen.getByText("Alpha Task")).toBeInTheDocument();
    expect(screen.getByText("Beta Task")).toBeInTheDocument();
    expect(screen.getByText("Gamma Task")).toBeInTheDocument();
  });

  it("renders priority badge on task card", async () => {
    const tasks = [makeTask({ id: "t1", priority: "HIGH", status: "TODO" })];
    axiosMock.get.mockResolvedValue({ data: { tasks, nextCursor: null } });
    useTaskmasterStore.setState({ tasks });

    await act(async () => {
      render(<KanbanBoard />);
    });
    const highEls = screen.getAllByText("HIGH");
    expect(highEls.length).toBeGreaterThanOrEqual(1);
  });

  it("shows recurrence badge when task has recurrence", async () => {
    const tasks = [makeTask({ id: "t1", recurrence: "weekly", status: "TODO" })];
    axiosMock.get.mockResolvedValue({ data: { tasks, nextCursor: null } });
    useTaskmasterStore.setState({ tasks });

    await act(async () => {
      render(<KanbanBoard />);
    });
    expect(screen.getByText("Weekly")).toBeInTheDocument();
  });

  it("shows overdue indicator for past due dates", async () => {
    const tasks = [
      makeTask({ id: "t1", dueDate: "2020-01-01T00:00:00.000Z", status: "TODO" }),
    ];
    axiosMock.get.mockResolvedValue({ data: { tasks, nextCursor: null } });
    useTaskmasterStore.setState({ tasks });

    await act(async () => {
      render(<KanbanBoard />);
    });
    // Overdue tasks show "!" prefix
    const overdueEl = screen.getByText(/!/);
    expect(overdueEl).toBeInTheDocument();
  });

  it("shows skeleton when tasksLoading is true", async () => {
    useTaskmasterStore.setState({ tasksLoading: true });
    // Delay axios response so skeleton is visible during render
    axiosMock.get.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ data: { tasks: [], nextCursor: null } }),
            100
          )
        )
    );

    render(<KanbanBoard />);
    // Skeleton should be immediately visible before fetch resolves
    const pulseDivs = document.querySelectorAll(".animate-pulse");
    expect(pulseDivs.length).toBeGreaterThan(0);
  });
});
