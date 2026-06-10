import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createGoal, deleteGoal, listGoals, updateGoal } from './goals.service.js';

const goalInputSchema = z.object({
  title: z.string().min(1),
  target: z.number().int().positive(),
  period: z.string().default('week'),
  kind: z.string().default('count'),
  categoryId: z.string().optional(),
});

export const goalsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });
    return listGoals(userId);
  });

  app.post('/', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });

    try {
      return reply.code(201).send(await createGoal(userId, goalInputSchema.parse(request.body)));
    } catch (error) {
      return reply.code(400).send({ statusCode: 400, message: error instanceof Error ? error.message : 'Erro ao criar meta' });
    }
  });

  app.patch('/:id', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });

    try {
      return reply.send(await updateGoal(userId, (request.params as { id: string }).id, goalInputSchema.partial().parse(request.body)));
    } catch (error) {
      return reply.code(404).send({ statusCode: 404, message: error instanceof Error ? error.message : 'Erro ao atualizar meta' });
    }
  });

  app.delete('/:id', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });

    try {
      return reply.send(await deleteGoal(userId, (request.params as { id: string }).id));
    } catch (error) {
      return reply.code(404).send({ statusCode: 404, message: error instanceof Error ? error.message : 'Erro ao apagar meta' });
    }
  });
};
