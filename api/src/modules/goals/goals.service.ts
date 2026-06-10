import { prisma } from '../../lib/prisma.js';

type GoalInput = {
  title: string;
  target: number;
  period?: string;
  kind?: string;
  categoryId?: string;
};

export async function listGoals(userId: string) {
  return prisma.goal.findMany({
    where: { userId },
    include: { category: true },
    orderBy: { title: 'asc' },
  });
}

export async function createGoal(userId: string, input: GoalInput) {
  return prisma.goal.create({
    data: {
      userId,
      title: input.title,
      target: input.target,
      period: input.period ?? 'week',
      kind: input.kind ?? 'count',
      categoryId: input.categoryId ?? null,
    },
    include: { category: true },
  });
}

export async function updateGoal(userId: string, id: string, input: Partial<GoalInput>) {
  const existing = await prisma.goal.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('Meta não encontrada');

  return prisma.goal.update({
    where: { id },
    data: {
      title: input.title,
      target: input.target,
      period: input.period,
      kind: input.kind,
      categoryId: input.categoryId ?? null,
    },
    include: { category: true },
  });
}

export async function deleteGoal(userId: string, id: string) {
  const existing = await prisma.goal.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('Meta não encontrada');

  await prisma.goal.delete({ where: { id } });
  return { success: true };
}
