// FILE: ~/taskmaster/src/app/api/tasks/[id]/tags/route.ts
// POST /api/tasks/:id/tags — add a tag to a task

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addTagToTaskSchema, formatZodErrors } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: taskId } = await params;

  try {
    // Verify task ownership
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId: session.user.id },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = addTagToTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: formatZodErrors(parsed.error) },
        { status: 400 }
      );
    }

    const { tagId } = parsed.data;

    // Verify tag ownership
    const tag = await prisma.tag.findFirst({
      where: { id: tagId, userId: session.user.id },
    });
    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Upsert to handle duplicate additions gracefully
    await prisma.taskTag.upsert({
      where: { taskId_tagId: { taskId, tagId } },
      create: { taskId, tagId },
      update: {},
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/tasks/:id/tags]", error);
    return NextResponse.json(
      { error: "Failed to add tag to task" },
      { status: 500 }
    );
  }
}
