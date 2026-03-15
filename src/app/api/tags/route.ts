// FILE: ~/taskmaster/src/app/api/tags/route.ts
// GET  /api/tags — list all tags for the authenticated user
// POST /api/tags — create a new tag

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createTagSchema, formatZodErrors } from "@/lib/validation";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tags = await prisma.tag.findMany({
      where: { userId: session.user.id },
      include: {
        _count: { select: { tasks: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ tags });
  } catch (error) {
    console.error("[GET /api/tags]", error);
    return NextResponse.json(
      { error: "Failed to fetch tags" },
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
    const parsed = createTagSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: formatZodErrors(parsed.error) },
        { status: 400 }
      );
    }

    const { name, color } = parsed.data;

    // Check for duplicate name for this user
    const existing = await prisma.tag.findFirst({
      where: { name: name.trim(), userId: session.user.id },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Validation failed", fields: { name: ["Tag name already exists"] } },
        { status: 400 }
      );
    }

    const tag = await prisma.tag.create({
      data: {
        name: name.trim(),
        color: color ?? "#6366f1",
        userId: session.user.id,
      },
      include: {
        _count: { select: { tasks: true } },
      },
    });

    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error("[POST /api/tags]", error);
    return NextResponse.json(
      { error: "Failed to create tag" },
      { status: 500 }
    );
  }
}
