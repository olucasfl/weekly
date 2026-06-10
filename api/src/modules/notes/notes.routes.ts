import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getNote, upsertNote } from './notes.service.js';

export const notesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });
    const date = (request.query as { date?: string }).date ?? new Date().toISOString().slice(0, 10);
    return getNote(userId, date);
  });

  app.put('/', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });
    const { date, content } = z.object({ date: z.string(), content: z.string() }).parse(request.body);
    return upsertNote(userId, date, content);
  });
};
