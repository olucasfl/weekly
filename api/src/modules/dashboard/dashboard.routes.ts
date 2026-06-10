import { FastifyPluginAsync } from 'fastify';
import { getDashboard } from './dashboard.service.js';

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });

    const start = (request.query as { start?: string }).start ?? new Date().toISOString().slice(0, 10);
    return getDashboard(userId, start);
  });
};
