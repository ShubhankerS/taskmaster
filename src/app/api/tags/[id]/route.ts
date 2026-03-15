// FILE: ~/taskmaster/src/app/api/tags/[id]/route.ts
// PUT    /api/tags/:id — rename/recolor a tag
// DELETE /api/tags/:id — delete a tag (cascades TaskTag associations)

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateTagSchema, formatZodErrors } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.tag.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateTagSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: formatZodErrors(parsed.error) },
        { status: 400 }
      );
    }

    const { name, color } = parsed.data;

    // Check for duplicate name (only if name is being changed)
    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.tag.findFirst({
        where: { name: name.trim(), userId: session.user.id },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Validation failed", fields: { name: ["Tag name already exists"] } },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.tag.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(color !== undefined ? { color } : {}),
      },
      include: {
        _count: { select: { tasks: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PUT /api/tags/:id]", error);
    return NextResponse.json(
      { error: "Failed to update tag" },
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
    const existing = await prisma.tag.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    await prisma.tag.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/tags/:id]", error);
    return NextResponse.json(
      { error: "Failed to delete tag" },
      { status: 500 }
    );
  }
}
