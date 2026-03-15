// FILE: ~/taskmaster/src/app/api/projects/route.ts
// GET  /api/projects — list all projects for the authenticated user
// POST /api/projects — create a new project

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createProjectSchema, formatZodErrors } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);

  try {
    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      include: {
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const nextCursor =
      projects.length === limit ? projects[projects.length - 1].id : null;

    return NextResponse.json({ projects, nextCursor });
  } catch (error) {
    console.error("[GET /api/projects]", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
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
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: formatZodErrors(parsed.error) },
        { status: 400 }
      );
    }

    const { name, description, color } = parsed.data;

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        description: description ?? null,
        color: color ?? "#6366f1",
        userId: session.user.id,
      },
      include: {
        _count: { select: { tasks: true } },
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("[POST /api/projects]", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
