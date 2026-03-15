// FILE: ~/taskmaster/src/app/api/notes/route.ts
// GET  /api/notes — list all notes for the authenticated user
// POST /api/notes — create a new note

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createNoteSchema, formatZodErrors } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);

  try {
    const notes = await prisma.note.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const nextCursor =
      notes.length === limit ? notes[notes.length - 1].id : null;

    return NextResponse.json({ notes, nextCursor });
  } catch (error) {
    console.error("[GET /api/notes]", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
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
    const parsed = createNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: formatZodErrors(parsed.error) },
        { status: 400 }
      );
    }

    const { title, content } = parsed.data;

    const note = await prisma.note.create({
      data: {
        title: title.trim(),
        content: content ?? "",
        userId: session.user.id,
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("[POST /api/notes]", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}
