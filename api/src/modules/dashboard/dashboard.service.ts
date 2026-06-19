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

  const today = new Date().toISOString().slice(0, 10);
  const since = offsetDate(today, -365);

  // Single query for all completions in the window
  const allCompletions = await prisma.completion.findMany({
    where: { userId, date: { gte: since, lte: today } },
  });

  // Group by date → taskId → done
  const byDate = new Map<string, Map<string, boolean>>();
  for (const c of allCompletions) {
    if (!byDate.has(c.date)) byDate.set(c.date, new Map());
    byDate.get(c.date)!.set(c.taskId, c.done);
  }

  let streak = 0;
  for (let i = 1; i <= 365; i++) {
    const dateStr = offsetDate(today, -i);
    const weekMonday = mondayOfDate(dateStr);
    const occsForDay = buildWeekOccurrences(taskLikes, weekMonday).filter((o) => o.date === dateStr);

    if (occsForDay.length === 0) continue; // dia sem tarefas — transparente

    const dayMap = byDate.get(dateStr) ?? new Map<string, boolean>();
    const allDone = occsForDay.every((o) => dayMap.get(o.task.id) === true);

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
