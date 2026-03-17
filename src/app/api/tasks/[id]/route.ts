// FILE: ~/taskmaster/src/app/api/tasks/[id]/route.ts
// GET    /api/tasks/:id — fetch a single task
// PUT    /api/tasks/:id — update a task
// DELETE /api/tasks/:id — delete a task

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { TaskStatus, TaskPriority } from "@prisma/client";
import { updateTaskSchema, formatZodErrors } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

// Shared include object so GET and PUT return identical shapes
const taskInclude = {
  project: { select: { id: true, name: true, color: true } },
  timeLogs: { orderBy: { startTime: "desc" as const } },
  subtasks: {
    include: {
      project: { select: { id: true, name: true, color: true } },
      tags: { include: { tag: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
  _count: { select: { subtasks: true } },
  tags: { include: { tag: true } },
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const task = await prisma.task.findFirst({
      where: { id, userId: session.user.id },
      include: taskInclude,
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("[GET /api/tasks/:id]", error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify ownership
    const existing = await prisma.task.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: formatZodErrors(parsed.error) },
        { status: 400 }
      );
    }

    const { title, description, status, priority, dueDate, projectId, parentTaskId, recurrence, order } =
      parsed.data;

    // Validate projectId ownership if provided
    if (projectId !== undefined && projectId !== null) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: session.user.id },
      });
      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: String(title).trim() } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(status !== undefined ? { status: status as TaskStatus } : {}),
        ...(priority !== undefined ? { priority: priority as TaskPriority } : {}),
        ...(dueDate !== undefined
          ? { dueDate: dueDate ? new Date(dueDate) : null }
          : {}),
        ...(projectId !== undefined ? { projectId: projectId ?? null } : {}),
        ...(parentTaskId !== undefined ? { parentTaskId: parentTaskId ?? null } : {}),
        ...(recurrence !== undefined ? { recurrence: recurrence ?? null } : {}),
        ...(order !== undefined ? { order } : {}),
      },
      include: taskInclude,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PUT /api/tasks/:id]", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.task.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await prisma.task.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/tasks/:id]", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}

