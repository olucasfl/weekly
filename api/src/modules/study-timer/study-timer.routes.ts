import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { isStudyTimerAllowed } from '../../lib/studyTimerAccess.js';
import {
  getCurrentSession,
  createSession,
  updateSession,
  pauseSession,
  resumeSession,
  cancelCurrentSession,
  getHistory,
} from './study-timer.service.js';

const createSessionSchema = z.object({
  startAt: z.string().datetime(),
  totalCycles: z.number().int().min(1).max(48),
  cycleMinutes: z.number().int().min(5).max(120).default(30),
});

export const studyTimerRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ message: 'Não autenticado' });
    if (!isStudyTimerAllowed(userId)) return reply.code(404).send({ message: 'Não encontrado' });
  });

  app.get('/session', async (request, reply) => {
    const userId = request.user!.sub;
    const session = await getCurrentSession(userId);
    return reply.send(session);
  });

  app.post('/session', async (request, reply) => {
    const userId = request.user!.sub;
    try {
      const data = createSessionSchema.parse(request.body);
      await createSession(userId, data);
      const session = await getCurrentSession(userId);
      return reply.code(201).send(session);
    } catch (e) {
      return reply.code(400).send({ message: e instanceof Error ? e.message : 'Erro' });
    }
  });

  app.patch('/session', async (request, reply) => {
    const userId = request.user!.sub;
    try {
      const data = createSessionSchema.parse(request.body);
      await updateSession(userId, data);
      const session = await getCurrentSession(userId);
      return reply.send(session);
    } catch (e) {
      return reply.code(400).send({ message: e instanceof Error ? e.message : 'Erro' });
    }
  });

  app.delete('/session', async (request, reply) => {
    const userId = request.user!.sub;
    try {
      const result = await cancelCurrentSession(userId);
      return reply.send(result);
    } catch (e) {
      return reply.code(404).send({ message: e instanceof Error ? e.message : 'Erro' });
    }
  });

  app.post('/session/pause', async (request, reply) => {
    const userId = request.user!.sub;
    try {
      await pauseSession(userId);
      const session = await getCurrentSession(userId);
      return reply.send(session);
    } catch (e) {
      return reply.code(400).send({ message: e instanceof Error ? e.message : 'Erro' });
    }
  });

  app.post('/session/resume', async (request, reply) => {
    const userId = request.user!.sub;
    try {
      await resumeSession(userId);
      const session = await getCurrentSession(userId);
      return reply.send(session);
    } catch (e) {
      return reply.code(400).send({ message: e instanceof Error ? e.message : 'Erro' });
    }
  });

  app.get('/history', async (request, reply) => {
    const userId = request.user!.sub;
    const { page } = request.query as { page?: string };
    const parsedPage = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const history = await getHistory(userId, parsedPage);
    return reply.send(history);
  });
};
