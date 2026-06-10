import { prisma } from '../../lib/prisma.js';

export async function markCompletion(userId: string, taskId: string, date: string, done: boolean) {
  return prisma.completion.upsert({
    where: { userId_taskId_date: { userId, taskId, date } },
    create: { userId, taskId, date, done, skipped: false },
    update: { done },
  });
}

export async function skipOccurrence(userId: string, taskId: string, date: string, skipped: boolean) {
  return prisma.completion.upsert({
    where: { userId_taskId_date: { userId, taskId, date } },
    create: { userId, taskId, date, done: false, skipped },
    update: { skipped },
  });
}

export async function getCompletionsForRange(userId: string, from: string, to: string) {
  return prisma.completion.findMany({
    where: { userId, date: { gte: from, lte: to } },
  });
}
