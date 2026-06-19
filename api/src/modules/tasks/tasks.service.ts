import { prisma } from '../../lib/prisma.js';

export type TaskRecord = {
  id: string;
  userId: string;
  title: string;
  type: 'RECURRING' | 'SCHEDULED';
  weekdays: number[];
  date?: string;
  endDate?: string | null;
  startTime: string;
  endTime?: string;
  reminder: boolean;
  reminderMin: number;
  active: boolean;
  notes?: string | null;
  categoryId?: string | null;
  recurrenceType?: string;
  biweeklyAnchor?: string | null;
  monthlyDay?: number | null;
  monthlyWeekday?: number | null;
  monthlyWeek?: number | null;
};

export async function listTasks(userId: string, type?: 'RECURRING' | 'SCHEDULED', includeDeleted = false) {
  return prisma.task.findMany({
    where: {
      userId,
      ...(type ? { type } : {}),
      ...(!includeDeleted ? { deletedAt: null } : {}),
    },
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
      endDate: input.endDate ?? null,
      startTime: input.startTime,
      endTime: input.endTime ?? null,
      reminder: input.reminder,
      reminderMin: input.reminderMin,
      active: input.active,
      notes: input.notes ?? '',
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
      date: input.date !== undefined ? (input.date ?? null) : undefined,
      endDate: input.endDate !== undefined ? (input.endDate ?? null) : undefined,
      startTime: input.startTime,
      endTime: input.endTime ?? null,
      reminder: input.reminder,
      reminderMin: input.reminderMin,
      active: input.active,
      notes: input.notes ?? undefined,
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
  const today = new Date().toISOString().slice(0, 10);
  await prisma.task.update({ where: { id }, data: { deletedAt: today } });
  return { success: true };
}

export async function addExtraOccurrence(userId: string, taskId: string, date: string) {
  const existing = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!existing) throw new Error('Tarefa não encontrada');

  const id = crypto.randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "ExtraOccurrence" ("id", "userId", "taskId", "date")
    VALUES (${id}, ${userId}, ${taskId}, ${date})
    ON CONFLICT ("userId", "taskId", "date") DO NOTHING
  `;

  // If this task was skipped on this day, un-skip it so it becomes visible again
  await prisma.$executeRaw`
    UPDATE "Completion" SET "skipped" = false
    WHERE "userId" = ${userId} AND "taskId" = ${taskId} AND "date" = ${date}
  `;

  return { success: true };
}

export async function getExtraOccurrencesForUser(userId: string) {
  return prisma.$queryRaw<{ id: string; userId: string; taskId: string; date: string }[]>`
    SELECT "id", "userId", "taskId", "date"
    FROM "ExtraOccurrence"
    WHERE "userId" = ${userId}
  `;
}
