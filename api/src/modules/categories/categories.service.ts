import { prisma } from '../../lib/prisma.js';

export type CategoryRecord = { id: string; name: string; color: string; userId: string };

export async function listCategories(userId: string) {
  return prisma.category.findMany({ where: { userId }, orderBy: { name: 'asc' } });
}

export async function createCategory(userId: string, input: { name: string; color: string }) {
  return prisma.category.create({ data: { userId, name: input.name, color: input.color } });
}

export async function updateCategory(userId: string, id: string, input: Partial<CategoryRecord>) {
  const existing = await prisma.category.findFirst({ where: { id, userId } });
  if (!existing) {
    throw new Error('Categoria não encontrada');
  }

  return prisma.category.update({ where: { id }, data: { name: input.name, color: input.color } });
}

export async function deleteCategory(userId: string, id: string) {
  const existing = await prisma.category.findFirst({ where: { id, userId } });
  if (!existing) {
    throw new Error('Categoria não encontrada');
  }

  await prisma.category.delete({ where: { id } });
  return { success: true };
}
