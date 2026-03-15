// FILE: ~/taskmaster/src/app/api/time-logs/[id]/route.ts
// DELETE /api/time-logs/:id — delete a time log entry

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.timeLog.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Time log not found" },
        { status: 404 }
      );
    }

    await prisma.timeLog.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/time-logs/:id]", error);
    return NextResponse.json(
      { error: "Failed to delete time log" },
      { status: 500 }
    );
  }
}
