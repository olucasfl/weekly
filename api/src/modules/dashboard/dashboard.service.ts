import { prisma } from '../../lib/prisma.js';
import { buildWeekOccurrences } from '../../../../shared/src/recurrence.js';

export async function getDashboard(userId: string, weekStart: string) {
  const weekEnd = offsetDate(weekStart, 6);

  const tasks = await prisma.task.findMany({
    where: { userId, active: true },
    include: { category: true },
  });

  const completions = await prisma.completion.findMany({
    where: { userId, date: { gte: weekStart, lte: weekEnd } },
  });

  const occurrences = buildWeekOccurrences(
    tasks.map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type as 'RECURRING' | 'SCHEDULED',
      weekdays: t.weekdays,
      date: t.date ?? undefined,
      startTime: t.startTime,
      endTime: t.endTime ?? undefined,
      reminder: t.reminder,
      reminderMin: t.reminderMin,
      active: t.active,
    })),
    weekStart,
  );

  const completionMap = new Map(completions.map((c) => [`${c.taskId}:${c.date}`, c]));
  const visible = occurrences.filter((o) => !completionMap.get(`${o.task.id}:${o.date}`)?.skipped);

  const total = visible.length;
  const completed = visible.filter((o) => completionMap.get(`${o.task.id}:${o.date}`)?.done).length;
  const pending = total - completed;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const EVENT_COLOR = '#f43f5e';

  const byCategory: Record<string, { name: string; color: string; completed: number; total: number }> = {};
  for (const o of visible) {
    const task = tasks.find((t) => t.id === o.task.id);
    const cat = task?.category;
    const isEvent = task?.type === 'SCHEDULED';
    const key = cat?.id ?? (isEvent ? '__event__' : '__none__');
    if (!byCategory[key]) {
      byCategory[key] = {
        name: cat?.name ?? (isEvent ? 'Evento' : 'Sem categoria'),
        color: cat?.color ?? (isEvent ? EVENT_COLOR : '#a0aec0'),
        completed: 0,
        total: 0,
      };
    }
    byCategory[key].total += 1;
    if (completionMap.get(`${o.task.id}:${o.date}`)?.done) byCategory[key].completed += 1;
  }

  const streak = await computeStreak(userId, weekStart);

  return {
    weekStart,
    completed,
    pending,
    total,
    percent,
    streak,
    byCategory: Object.values(byCategory),
  };
}

async function computeStreak(userId: string, weekStart: string): Promise<number> {
  let streak = 0;
  let cursor = weekStart;

  for (let i = 0; i < 52; i++) {
    const from = cursor;
    const to = offsetDate(cursor, 6);

    const tasks = await prisma.task.findMany({ where: { userId, active: true } });
    if (tasks.length === 0) break;

    const occs = buildWeekOccurrences(
      tasks.map((t) => ({
        id: t.id,
        title: t.title,
        type: t.type as 'RECURRING' | 'SCHEDULED',
        weekdays: t.weekdays,
        date: t.date ?? undefined,
        startTime: t.startTime,
        endTime: t.endTime ?? undefined,
        reminder: t.reminder,
        reminderMin: t.reminderMin,
        active: t.active,
      })),
      from,
    );
    if (occs.length === 0) break;

    const comps = await prisma.completion.findMany({ where: { userId, date: { gte: from, lte: to } } });
    const doneSet = new Set(comps.filter((c) => c.done).map((c) => `${c.taskId}:${c.date}`));
    const allDone = occs.every((o) => doneSet.has(`${o.task.id}:${o.date}`));

    if (!allDone) break;
    streak++;
    cursor = offsetDate(cursor, -7);
  }

  return streak;
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
