// FILE: ~/taskmaster/src/lib/validation.ts
// Zod schemas for all API request bodies.

import { z } from "zod";

// ─── Task ─────────────────────────────────────────────────────────────────────

export const taskStatusSchema = z.enum(["BACKLOG", "WILD_IDEA", "TODO", "IN_PROGRESS", "DONE", "WONT_DO"]);
export const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const recurrenceSchema = z
  .enum(["daily", "weekly", "monthly"])
  .nullable()
  .optional();

export const createTaskSchema = z.object({
  title: z
    .string({ required_error: "Title is required" })
    .trim()
    .min(1, "Title cannot be empty")
    .max(255, "Title is too long"),
  description: z.string().max(5000).nullable().optional(),
  status: taskStatusSchema.optional().default("BACKLOG"),
  priority: taskPrioritySchema.optional().default("MEDIUM"),
  dueDate: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()),
  projectId: z.string().nullable().optional(),
  parentTaskId: z.string().nullable().optional(),
  recurrence: recurrenceSchema,
});

export const updateTaskSchema = z.object({
  title: z.string().min(1, "Title cannot be empty").max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  dueDate: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()),
  projectId: z.string().nullable().optional(),
  parentTaskId: z.string().nullable().optional(),
  recurrence: recurrenceSchema,
  order: z.number().int().optional(),
});

// ─── Project ──────────────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  name: z
    .string({ required_error: "Project name is required" })
    .min(1, "Name cannot be empty")
    .max(100, "Name is too long"),
  description: z.string().max(1000).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex color")
    .optional()
    .default("#6366f1"),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex color")
    .optional(),
});

// ─── Note ─────────────────────────────────────────────────────────────────────

export const createNoteSchema = z.object({
  title: z
    .string({ required_error: "Title is required" })
    .min(1, "Title cannot be empty")
    .max(255, "Title is too long"),
  content: z.string().optional().default(""),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().optional(),
});

// ─── TimeLog ──────────────────────────────────────────────────────────────────

export const createTimeLogSchema = z.object({
  taskId: z.string({ required_error: "taskId is required" }).min(1),
  description: z.string().max(500).nullable().optional(),
  startTime: z.string().datetime({ offset: true }).optional(),
  endTime: z.string().datetime({ offset: true }).nullable().optional(),
});

// ─── Tag ──────────────────────────────────────────────────────────────────────

export const createTagSchema = z.object({
  name: z
    .string({ required_error: "Tag name is required" })
    .trim()
    .min(1, "Name cannot be empty")
    .max(50, "Name is too long"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex color")
    .optional()
    .default("#6366f1"),
});

export const updateTagSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex color")
    .optional(),
});

export const addTagToTaskSchema = z.object({
  tagId: z.string({ required_error: "tagId is required" }).min(1),
});

// ─── Helper: format Zod errors for API responses ─────────────────────────────

export function formatZodErrors(
  errors: z.ZodError
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of errors.issues) {
    const path = issue.path.join(".") || "_root";
    if (!fieldErrors[path]) fieldErrors[path] = [];
    fieldErrors[path].push(issue.message);
  }
  return fieldErrors;
}
