// FILE: ~/taskmaster/src/app/api/time-logs/route.ts
// GET  /api/time-logs — list time logs for the authenticated user
// POST /api/time-logs — create/start a new time log entry

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createTimeLogSchema, formatZodErrors } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);

  try {
    const timeLogs = await prisma.timeLog.findMany({
      where: {
        userId: session.user.id,
        ...(taskId ? { taskId } : {}),
      },
      include: {
        task: { select: { id: true, title: true } },
      },
      orderBy: { startTime: "desc" },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const nextCursor =
      timeLogs.length === limit ? timeLogs[timeLogs.length - 1].id : null;

    return NextResponse.json({ timeLogs, nextCursor });
  } catch (error) {
    console.error("[GET /api/time-logs]", error);
    return NextResponse.json(
      { error: "Failed to fetch time logs" },
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
    const parsed = createTimeLogSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: formatZodErrors(parsed.error) },
        { status: 400 }
      );
    }

    const { taskId, description, startTime, endTime } = parsed.data;

    // Verify task ownership
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId: session.user.id },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const start = startTime ? new Date(startTime) : new Date();
    const end = endTime ? new Date(endTime) : null;
    const duration =
      end ? Math.round((end.getTime() - start.getTime()) / 1000) : null;

    const timeLog = await prisma.timeLog.create({
      data: {
        description: description ?? null,
        startTime: start,
        endTime: end,
        duration,
        userId: session.user.id,
        taskId,
      },
      include: {
        task: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json(timeLog, { status: 201 });
  } catch (error) {
    console.error("[POST /api/time-logs]", error);
    return NextResponse.json(
      { error: "Failed to create time log" },
      { status: 500 }
    );
  }
}
