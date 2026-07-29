import { prisma } from '../../lib/prisma.js';
import { buildWeekOccurrences } from '../../../../shared/src/recurrence.js';
import { getGoalsSummary } from '../goals/goals.service.js';
import { getExtraOccurrencesForUser } from '../tasks/tasks.service.js';

// In-memory streak cache: userId → { value, expiry }
const streakCache = new Map<string, { value: number; expiry: number }>();
const STREAK_TTL = 5 * 60 * 1000; // 5 minutes

export async function getDashboard(userId: string, weekStart: string) {
  const weekEnd = offsetDate(weekStart, 6);

  const [tasks, completions, extraOccurrences] = await Promise.all([
    prisma.task.findMany({ where: { userId, active: true }, include: { category: true } }),
    prisma.completion.findMany({ where: { userId, date: { gte: weekStart, lte: weekEnd } } }),
    getExtraOccurrencesForUser(userId, weekStart, weekEnd),
  ]);

  // Days manually added to a routine outside its normal weekdays (POST /tasks/:id/extra-days) —
  // without these, days the user explicitly added and completed never enter the total/completed count.
  const extraByTaskId = new Map<string, string[]>();
  for (const eo of extraOccurrences) {
    const list = extraByTaskId.get(eo.taskId) ?? [];
    list.push(eo.date);
    extraByTaskId.set(eo.taskId, list);
  }

  const occurrences = buildWeekOccurrences(
    tasks.map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type as 'RECURRING' | 'SCHEDULED',
      weekdays: t.weekdays,
      date: t.date ?? undefined,
      // endDate: without it, a multi-day event collapses to a single occurrence
      // instead of one per day it actually spans.
      endDate: t.endDate ?? undefined,
      startTime: t.startTime,
      endTime: t.endTime ?? undefined,
      reminder: t.reminder,
      reminderMin: t.reminderMin,
      active: t.active,
      // deletedAt: without it, buildWeekOccurrences' notDeleted() check never has anything
      // to compare against, so a deleted routine keeps generating occurrences forever —
      // occurrences the user can never mark done because the routine is gone from every
      // screen, permanently dragging the percentage down.
      deletedAt: t.deletedAt ?? undefined,
      // Without these, buildWeekOccurrences defaults recurrenceType to 'weekly' for every
      // task: biweekly routines get charged every week instead of every other week, and
      // monthly/yearly routines (which don't use weekdays[]) vanish from the count entirely.
      recurrenceType: t.recurrenceType,
      biweeklyAnchor: t.biweeklyAnchor ?? undefined,
      monthlyDay: t.monthlyDay ?? undefined,
      monthlyWeekday: t.monthlyWeekday ?? undefined,
      monthlyWeek: t.monthlyWeek ?? undefined,
      yearlyMonth: t.yearlyMonth ?? undefined,
      extraDays: extraByTaskId.get(t.id) ?? [],
    })),
    weekStart,
  );

  const completionMap = new Map(completions.map((c) => [`${c.taskId}:${c.date}`, c]));
  const visible = occurrences
    .filter((o) => !completionMap.get(`${o.task.id}:${o.date}`)?.skipped)
    .filter((o) => {
      if (!o.task.deletedAt) return true;
      // Mirrors week.service.ts: a deleted task's pending occurrences are hidden from
      // the week view too, only surviving there if already done. Without the same rule
      // here, a pending occurrence the user can never even see keeps dragging the
      // percentage down — "completed everything visible" still doesn't reach 100%.
      return completionMap.get(`${o.task.id}:${o.date}`)?.done === true;
    });

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
  const cached = streakCache.get(userId);
  if (cached && cached.expiry > Date.now()) return cached.value;

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
    // Same fix as above — otherwise a deleted routine keeps showing up as an
    // unfinished occurrence on every past day, permanently breaking the streak.
    deletedAt: t.deletedAt ?? undefined,
    // Same recurrence-type fix as the main occurrences mapping — otherwise the streak
    // walk also treats every biweekly/monthly/yearly routine as if it were weekly.
    recurrenceType: t.recurrenceType,
    biweeklyAnchor: t.biweeklyAnchor ?? undefined,
    monthlyDay: t.monthlyDay ?? undefined,
    monthlyWeekday: t.monthlyWeekday ?? undefined,
    monthlyWeek: t.monthlyWeek ?? undefined,
    yearlyMonth: t.yearlyMonth ?? undefined,
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
    const dayMap = byDate.get(dateStr) ?? new Map<string, boolean>();
    // Same "hide pending occurrences of deleted tasks" rule as getDashboard above —
    // otherwise a ghost pending occurrence the user can't see keeps breaking the streak
    // on some day far in the past, every single day, forever.
    const occsForDay = buildWeekOccurrences(taskLikes, weekMonday)
      .filter((o) => o.date === dateStr)
      .filter((o) => !o.task.deletedAt || dayMap.get(o.task.id) === true);

    if (occsForDay.length === 0) continue; // dia sem tarefas (visíveis) — transparente

    const allDone = occsForDay.every((o) => dayMap.get(o.task.id) === true);

    if (!allDone) break;
    streak++;
  }

  streakCache.set(userId, { value: streak, expiry: Date.now() + STREAK_TTL });
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
