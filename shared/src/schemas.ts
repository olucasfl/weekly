import { z } from 'zod';

export const taskTypeSchema = z.enum(['RECURRING', 'SCHEDULED']);

export const taskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  type: taskTypeSchema,
  weekdays: z.array(z.number().int().min(0).max(6)).default([]),
  date: z.string().optional(),
  endDate: z.string().optional(),
  startTime: z.string().min(1),
  endTime: z.string().optional(),
  reminder: z.boolean().default(true),
  reminderMin: z.number().int().default(60),
  important: z.boolean().default(false),
  countdownDays: z.number().int().nullable().optional(),
  yearlyMonth: z.number().int().min(1).max(12).nullable().optional(),
  categoryId: z.string().optional(),
  active: z.boolean().default(true),
});

export const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  color: z.string().min(1),
});

export const goalSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  target: z.number().int().positive(),
  period: z.string().default('week'),
  kind: z.string().default('count'),
  categoryId: z.string().optional(),
});

export type TaskInput = z.infer<typeof taskSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type GoalInput = z.infer<typeof goalSchema>;
