import { FastifyPluginAsync } from 'fastify';
import { getWeekOccurrences } from './week.service.js';
import { listTasks } from '../tasks/tasks.service.js';

export const weekRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });

    const start = (request.query as { start?: string }).start ?? new Date().toISOString().slice(0, 10);
    const tasks = await listTasks(userId);

    return getWeekOccurrences(
      userId,
      tasks.map((task) => ({
        id: task.id,
        title: task.title,
        type: task.type as 'RECURRING' | 'SCHEDULED',
        weekdays: task.weekdays,
        date: task.date ?? undefined,
        startTime: task.startTime,
        endTime: task.endTime ?? undefined,
        reminder: task.reminder,
        reminderMin: task.reminderMin,
        active: task.active,
        categoryId: task.categoryId ?? undefined,
        category: task.category ?? undefined,
        recurrenceType: task.recurrenceType,
        biweeklyAnchor: task.biweeklyAnchor ?? undefined,
        monthlyDay: task.monthlyDay ?? undefined,
        monthlyWeekday: task.monthlyWeekday ?? undefined,
        monthlyWeek: task.monthlyWeek ?? undefined,
      })),
      start,
    );
  });
};
