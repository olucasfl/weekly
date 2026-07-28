import { FastifyPluginAsync } from 'fastify';
import { getWeekOccurrences } from './week.service.js';
import { getExtraOccurrencesForUser, listTasks } from '../tasks/tasks.service.js';

// Monday of the current week (UTC-based), used only when the caller omits `start` —
// falling back to "today" instead would shift the whole 7-day window whenever today
// isn't a Monday, producing a week that doesn't match what the app shows.
function currentWeekStartISO(): string {
  const d = new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00Z');
  const diff = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

export const weekRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });

    const start = (request.query as { start?: string }).start ?? currentWeekStartISO();
    const weekEnd = new Date(start + 'T12:00:00Z');
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    const end = weekEnd.toISOString().slice(0, 10);

    const [tasks, extraOccurrences] = await Promise.all([
      listTasks(userId, undefined, true),
      getExtraOccurrencesForUser(userId, start, end),
    ]);

    const extraByTaskId = new Map<string, string[]>();
    for (const eo of extraOccurrences) {
      const list = extraByTaskId.get(eo.taskId) ?? [];
      list.push(eo.date);
      extraByTaskId.set(eo.taskId, list);
    }

    return getWeekOccurrences(
      userId,
      tasks.map((task) => ({
        id: task.id,
        title: task.title,
        type: task.type as 'RECURRING' | 'SCHEDULED',
        weekdays: task.weekdays,
        date: task.date ?? undefined,
        endDate: task.endDate ?? undefined,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        yearlyMonth: (task as any).yearlyMonth ?? undefined,
        deletedAt: task.deletedAt ?? undefined,
        notes: task.notes ?? undefined,
        extraDays: extraByTaskId.get(task.id) ?? [],
      })),
      start,
    );
  });
};
