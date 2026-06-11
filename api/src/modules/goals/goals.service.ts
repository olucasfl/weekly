import { prisma } from '../../lib/prisma.js';

export async function listGoals(userId: string, weekStart: string) {
  // Recurring goals (weekStart IS NULL) + one-time goals for this specific week
  const goals = await prisma.goal.findMany({
    where: {
      userId,
      OR: [{ weekStart: null }, { weekStart }],
    },
    include: {
      category: { select: { id: true, name: true, color: true } },
      progresses: { where: { userId, weekStart } },
    },
    orderBy: [{ weekStart: 'asc' }, { id: 'asc' }],
  });

  return goals.map((g) => ({
    id:         g.id,
    title:      g.title,
    target:     g.target,
    weekStart:  g.weekStart,
    recurring:  g.weekStart === null,
    categoryId: g.categoryId,
    category:   g.category,
    count:      g.progresses[0]?.count ?? 0,
    done:       (g.progresses[0]?.count ?? 0) >= g.target,
  }));
}

export async function createGoal(
  userId: string,
  input: { title: string; target: number; weekStart?: string | null; categoryId?: string | null },
) {
  return prisma.goal.create({
    data: {
      userId,
      title:      input.title,
      target:     input.target,
      weekStart:  input.weekStart ?? null,
      categoryId: input.categoryId ?? null,
    },
    include: { category: { select: { id: true, name: true, color: true } } },
  });
}

export async function updateGoal(
  userId: string,
  id: string,
  input: { title?: string; target?: number; categoryId?: string | null },
) {
  const existing = await prisma.goal.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('Meta não encontrada');
  return prisma.goal.update({
    where: { id },
    data: {
      title:      input.title,
      target:     input.target,
      categoryId: input.categoryId ?? null,
    },
    include: { category: { select: { id: true, name: true, color: true } } },
  });
}

export async function deleteGoal(userId: string, id: string) {
  const existing = await prisma.goal.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('Meta não encontrada');
  await prisma.goal.delete({ where: { id } });
  return { success: true };
}

export async function updateGoalProgress(
  userId: string,
  goalId: string,
  weekStart: string,
  count: number,
) {
  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } });
  if (!goal) throw new Error('Meta não encontrada');

  const clamped = Math.max(0, Math.min(count, goal.target));

  await prisma.$executeRaw`
    INSERT INTO "GoalProgress" ("id", "userId", "goalId", "weekStart", "count")
    VALUES (${crypto.randomUUID()}, ${userId}, ${goalId}, ${weekStart}, ${clamped})
    ON CONFLICT ("userId", "goalId", "weekStart") DO UPDATE SET "count" = ${clamped}
  `;

  return { goalId, weekStart, count: clamped, done: clamped >= goal.target };
}

export async function getGoalsSummary(userId: string, weekStart: string) {
  const goals = await listGoals(userId, weekStart);
  const total     = goals.length;
  const completed = goals.filter((g) => g.done).length;
  return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
}
