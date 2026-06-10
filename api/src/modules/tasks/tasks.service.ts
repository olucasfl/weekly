import { prisma } from '../../lib/prisma.js';

export type TaskRecord = {
  id: string;
  userId: string;
  title: string;
  type: 'RECURRING' | 'SCHEDULED';
  weekdays: number[];
  date?: string;
  startTime: string;
  endTime?: string;
  reminder: boolean;
  reminderMin: number;
  active: boolean;
  categoryId?: string | null;
  recurrenceType?: string;
  biweeklyAnchor?: string | null;
  monthlyDay?: number | null;
  monthlyWeekday?: number | null;
  monthlyWeek?: number | null;
};

export async function listTasks(userId: string, type?: 'RECURRING' | 'SCHEDULED') {
  return prisma.task.findMany({
    where: { userId, ...(type ? { type } : {}) },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    include: { category: { select: { id: true, name: true, color: true } } },
  });
}

export async function createTask(userId: string, input: Omit<TaskRecord, 'id' | 'userId'>) {
  return prisma.task.create({
    data: {
      userId,
      title: input.title,
      type: input.type,
      weekdays: input.weekdays ?? [],
      date: input.date ?? null,
      startTime: input.startTime,
      endTime: input.endTime ?? null,
      reminder: input.reminder,
      reminderMin: input.reminderMin,
      active: input.active,
      categoryId: input.categoryId ?? null,
      recurrenceType: input.recurrenceType ?? 'weekly',
      biweeklyAnchor: input.biweeklyAnchor ?? null,
      monthlyDay: input.monthlyDay ?? null,
      monthlyWeekday: input.monthlyWeekday ?? null,
      monthlyWeek: input.monthlyWeek ?? null,
    },
  });
}

export async function updateTask(userId: string, id: string, input: Partial<TaskRecord>) {
  const existing = await prisma.task.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('Tarefa não encontrada');

  return prisma.task.update({
    where: { id },
    data: {
      title: input.title,
      type: input.type,
      weekdays: input.weekdays,
      date: input.date ?? null,
      startTime: input.startTime,
      endTime: input.endTime ?? null,
      reminder: input.reminder,
      reminderMin: input.reminderMin,
      active: input.active,
      categoryId: input.categoryId ?? null,
      recurrenceType: input.recurrenceType,
      biweeklyAnchor: input.biweeklyAnchor ?? null,
      monthlyDay: input.monthlyDay ?? null,
      monthlyWeekday: input.monthlyWeekday ?? null,
      monthlyWeek: input.monthlyWeek ?? null,
    },
  });
}

export async function deleteTask(userId: string, id: string) {
  const existing = await prisma.task.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('Tarefa não encontrada');
  await prisma.task.delete({ where: { id } });
  return { success: true };
}
