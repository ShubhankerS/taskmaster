// FILE: ~/taskmaster/src/app/api/tasks/route.test.ts
// Unit tests for the /api/tasks route handlers (Prisma and auth mocked).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Hoist mock data so it is available inside vi.mock factories ──────────────

const mockTask = vi.hoisted(() => ({
  id: "task-abc",
  title: "My Task",
  description: null,
  status: "TODO" as const,
  priority: "MEDIUM" as const,
  dueDate: null,
  recurrence: null,
  projectId: null,
  parentTaskId: null,
  userId: "user-123",
  createdAt: new Date(),
  updatedAt: new Date(),
  project: null,
  subtasks: [],
  tags: [],
  _count: { subtasks: 0 },
  order: 0,
}));

// ─── Mock next-auth ────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "user-123", name: "Test User", email: "test@example.com" },
  }),
  signOut: vi.fn(),
}));

// ─── Mock Prisma ───────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  prisma: {
    task: {
      findMany: vi.fn().mockResolvedValue([mockTask]),
      findFirst: vi.fn().mockResolvedValue(mockTask),
      create: vi.fn().mockResolvedValue(mockTask),
      update: vi.fn().mockResolvedValue(mockTask),
      delete: vi.fn().mockResolvedValue(mockTask),
    },
    project: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

// ─── Import after mocks are set up ────────────────────────────────────────────

import { GET, POST } from "./route";
import { prisma } from "@/lib/db";

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeRequest(method: string, url: string, body?: object): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/tasks", () => {
  it("returns paginated tasks for authenticated user", async () => {
    const req = makeRequest("GET", "http://localhost/api/tasks");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("tasks");
    expect(Array.isArray(json.tasks)).toBe(true);
    expect(json.tasks[0].id).toBe("task-abc");
  });

  it("calls prisma.task.findMany with user id filter", async () => {
    const req = makeRequest("GET", "http://localhost/api/tasks");
    await GET(req);
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-123" }),
      })
    );
  });
});

describe("POST /api/tasks", () => {
  beforeEach(() => {
    vi.mocked(prisma.task.create).mockResolvedValue(mockTask);
  });

  it("creates a task and returns 201", async () => {
    const req = makeRequest("POST", "http://localhost/api/tasks", {
      title: "New Task",
      status: "TODO",
      priority: "HIGH",
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("task-abc");
  });

  it("returns 400 when title is missing", async () => {
    const req = makeRequest("POST", "http://localhost/api/tasks", {
      priority: "HIGH",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toHaveProperty("error");
  });

  it("returns 400 when title is empty string", async () => {
    const req = makeRequest("POST", "http://localhost/api/tasks", {
      title: "   ",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
