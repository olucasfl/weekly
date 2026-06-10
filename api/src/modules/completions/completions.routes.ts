import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { markCompletion, skipOccurrence } from './completions.service.js';

const completionInputSchema = z.object({
  taskId: z.string().min(1),
  date: z.string().min(1),
  done: z.boolean(),
});

const skipInputSchema = z.object({
  taskId: z.string().min(1),
  date: z.string().min(1),
  skipped: z.boolean(),
});

export const completionsRoutes: FastifyPluginAsync = async (app) => {
  app.put('/', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });

    const body = completionInputSchema.parse(request.body);
    return markCompletion(userId, body.taskId, body.date, body.done);
  });

  app.patch('/', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });

    const body = skipInputSchema.parse(request.body);
    return skipOccurrence(userId, body.taskId, body.date, body.skipped);
  });
};
