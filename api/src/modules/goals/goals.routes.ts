import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  createGoal, deleteGoal, getGoalsSummary,
  listGoals, updateGoal, updateGoalProgress,
} from './goals.service.js';

const goalInputSchema = z.object({
  title:      z.string().min(1),
  target:     z.number().int().min(1).max(99).default(1),
  weekStart:  z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
});

export const goalsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ message: 'Não autenticado' });
    const { weekStart } = request.query as { weekStart?: string };
    if (!weekStart) return reply.code(400).send({ message: 'weekStart obrigatório' });
    return listGoals(userId, weekStart);
  });

  app.get('/summary', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ message: 'Não autenticado' });
    const { weekStart } = request.query as { weekStart?: string };
    if (!weekStart) return reply.code(400).send({ message: 'weekStart obrigatório' });
    return getGoalsSummary(userId, weekStart);
  });

  app.post('/', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ message: 'Não autenticado' });
    try {
      const data = goalInputSchema.parse(request.body);
      const goal = await createGoal(userId, data);
      return reply.code(201).send(goal);
    } catch (e) {
      return reply.code(400).send({ message: e instanceof Error ? e.message : 'Erro' });
    }
  });

  app.patch('/:id', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ message: 'Não autenticado' });
    try {
      const data = goalInputSchema.partial().parse(request.body);
      const goal = await updateGoal(userId, (request.params as { id: string }).id, data);
      return reply.send(goal);
    } catch (e) {
      return reply.code(400).send({ message: e instanceof Error ? e.message : 'Erro' });
    }
  });

  app.delete('/:id', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ message: 'Não autenticado' });
    try {
      return await deleteGoal(userId, (request.params as { id: string }).id);
    } catch (e) {
      return reply.code(404).send({ message: e instanceof Error ? e.message : 'Erro' });
    }
  });

  app.put('/:id/progress', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ message: 'Não autenticado' });
    try {
      const { weekStart, count } = z.object({
        weekStart: z.string(),
        count:     z.number().int().min(0),
      }).parse(request.body);
      return await updateGoalProgress(userId, (request.params as { id: string }).id, weekStart, count);
    } catch (e) {
      return reply.code(400).send({ message: e instanceof Error ? e.message : 'Erro' });
    }
  });
};
