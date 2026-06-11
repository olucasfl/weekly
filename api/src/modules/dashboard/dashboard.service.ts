import { prisma } from '../../lib/prisma.js';
import { buildWeekOccurrences } from '../../../../shared/src/recurrence.js';
import { getGoalsSummary } from '../goals/goals.service.js';

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

  const [streak, goals] = await Promise.all([
    computeStreak(userId, weekStart),
    getGoalsSummary(userId, weekStart),
  ]);

  return {
    weekStart,
    completed,
    pending,
    total,
    percent,
    streak,
    byCategory: Object.values(byCategory),
    goals,
  };
}

async function computeStreak(userId: string, _weekStart: string): Promise<number> {
  const tasks = await prisma.task.findMany({ where: { userId, active: true } });
  if (tasks.length === 0) return 0;

  const taskLikes = tasks.map((t) => ({
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
  }));

  // Check last 365 days going back from yesterday
  const today = new Date().toISOString().slice(0, 10);
  let streak = 0;

  for (let i = 1; i <= 365; i++) {
    const dateStr = offsetDate(today, -i);
    // Build occurrences for the week that contains this date, then filter to just this day
    const weekMonday = mondayOfDate(dateStr);
    const occsForWeek = buildWeekOccurrences(taskLikes, weekMonday);
    const occsForDay = occsForWeek.filter((o) => o.date === dateStr);

    if (occsForDay.length === 0) continue; // no tasks this day — transparent

    const comps = await prisma.completion.findMany({ where: { userId, date: dateStr } });
    const doneSet = new Set(comps.filter((c) => c.done).map((c) => c.taskId));
    const allDone = occsForDay.every((o) => doneSet.has(o.task.id));

    if (!allDone) break;
    streak++;
  }

  return streak;
}

function mondayOfDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
