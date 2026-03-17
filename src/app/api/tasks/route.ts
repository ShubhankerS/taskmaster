// FILE: ~/taskmaster/src/app/api/tasks/route.ts
// GET  /api/tasks  — list all tasks for the authenticated user
// POST /api/tasks  — create a new task

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { TaskStatus } from "@prisma/client";
import { createTaskSchema, formatZodErrors } from "@/lib/validation";
import { z } from "zod";

// Shared include object so GET and POST return identical shapes
const taskInclude = {
  project: {
    select: { id: true, name: true, color: true },
  },
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

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status") as TaskStatus | null;
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);

  try {
    const tasks = await prisma.task.findMany({
      where: {
        userId: session.user.id,
        parentTaskId: null, // only top-level tasks (Big Ideas) by default
        ...(projectId ? { projectId } : {}),
        ...(status ? { status } : {}),
      },
      include: taskInclude,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const nextCursor =
      tasks.length === limit ? tasks[tasks.length - 1].id : null;

    return NextResponse.json({ tasks, nextCursor });
  } catch (error) {
    console.error("[GET /api/tasks]", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: formatZodErrors(parsed.error) },
        { status: 400 }
      );
    }

    const { title, description, status, priority, dueDate, projectId, parentTaskId, recurrence } =
      parsed.data;

    // Validate projectId belongs to this user
    if (projectId) {
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

    // Validate parentTaskId belongs to this user
    if (parentTaskId) {
      const parent = await prisma.task.findFirst({
        where: { id: parentTaskId, userId: session.user.id },
      });
      if (!parent) {
        return NextResponse.json(
          { error: "Parent task not found" },
          { status: 404 }
        );
      }
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description ?? null,
        status: status ?? "BACKLOG",
        priority: priority ?? "MEDIUM",
        dueDate: dueDate ? new Date(dueDate) : null,
        recurrence: recurrence ?? null,
        userId: session.user.id,
        projectId: projectId ?? null,
        parentTaskId: parentTaskId ?? null,
      },
      include: taskInclude,
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", fields: formatZodErrors(error) },
        { status: 400 }
      );
    }
    console.error("[POST /api/tasks]", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
