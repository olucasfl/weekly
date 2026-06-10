import { prisma } from '../../lib/prisma.js';

export async function getNote(userId: string, date: string) {
  const note = await prisma.note.findUnique({ where: { userId_date: { userId, date } } });
  return { date, content: note?.content ?? '' };
}

export async function upsertNote(userId: string, date: string, content: string) {
  return prisma.note.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, content },
    update: { content },
  });
}
