import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createCategory, deleteCategory, listCategories, updateCategory } from './categories.service.js';

const categoryInputSchema = z.object({
  name: z.string().min(1),
  color: z.string().min(1),
});

export const categoriesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });
    }

    return listCategories(userId);
  });

  app.post('/', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });
    }

    try {
      const category = await createCategory(userId, categoryInputSchema.parse(request.body));
      return reply.code(201).send(category);
    } catch (error) {
      return reply.code(400).send({ statusCode: 400, message: error instanceof Error ? error.message : 'Erro ao criar categoria' });
    }
  });

  app.patch('/:id', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });
    }

    try {
      const category = await updateCategory(userId, (request.params as { id: string }).id, categoryInputSchema.partial().parse(request.body));
      return reply.send(category);
    } catch (error) {
      return reply.code(404).send({ statusCode: 404, message: error instanceof Error ? error.message : 'Erro ao atualizar categoria' });
    }
  });

  app.delete('/:id', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });
    }

    try {
      const result = await deleteCategory(userId, (request.params as { id: string }).id);
      return reply.send(result);
    } catch (error) {
      return reply.code(404).send({ statusCode: 404, message: error instanceof Error ? error.message : 'Erro ao apagar categoria' });
    }
  });
};
