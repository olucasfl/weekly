import { FastifyPluginAsync } from 'fastify';
import { getDashboard } from './dashboard.service.js';

// Monday of the current week (UTC-based), used only when the caller omits `start` —
// falling back to "today" instead would shift the whole 7-day window whenever today
// isn't a Monday, producing a week that doesn't match what the app shows.
function currentWeekStartISO(): string {
  const d = new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00Z');
  const diff = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });

    const start = (request.query as { start?: string }).start ?? currentWeekStartISO();
    return getDashboard(userId, start);
  });
};
