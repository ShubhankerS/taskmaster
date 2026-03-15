// FILE: ~/taskmaster/src/app/api/tasks/[id]/tags/[tagId]/route.ts
// DELETE /api/tasks/:id/tags/:tagId — remove a tag from a task

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string; tagId: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: taskId, tagId } = await params;

  try {
    // Verify task ownership
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId: session.user.id },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Verify the TaskTag record exists before deleting
    const taskTag = await prisma.taskTag.findUnique({
      where: { taskId_tagId: { taskId, tagId } },
    });
    if (!taskTag) {
      return NextResponse.json(
        { error: "Tag not associated with this task" },
        { status: 404 }
      );
    }

    await prisma.taskTag.delete({
      where: { taskId_tagId: { taskId, tagId } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/tasks/:id/tags/:tagId]", error);
    return NextResponse.json(
      { error: "Failed to remove tag from task" },
      { status: 500 }
    );
  }
}
