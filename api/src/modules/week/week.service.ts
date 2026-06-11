import { buildWeekOccurrences, type TaskLike, type OccurrenceItem } from '../../../../shared/src/recurrence.js';
import { getCompletionsForRange } from '../completions/completions.service.js';

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function getWeekOccurrences(userId: string, tasks: TaskLike[], weekStart: string) {
  const weekEnd = offsetDate(weekStart, 6);
  const completions = await getCompletionsForRange(userId, weekStart, weekEnd);
  const completionMap = new Map(completions.map((c) => [`${c.taskId}:${c.date}`, c]));

  const regular = buildWeekOccurrences(tasks, weekStart);

  // Extra occurrences handled here so tsx watch picks it up (shared/ may not be watched)
  const extraItems: OccurrenceItem[] = [];
  for (const task of tasks) {
    if (task.active === false) continue;
    for (const extraDay of task.extraDays ?? []) {
      if (extraDay < weekStart || extraDay > weekEnd) continue;
      if (task.deletedAt && extraDay > task.deletedAt) continue;
      if (!regular.some((o) => o.task.id === task.id && o.date === extraDay)) {
        extraItems.push({ task, date: extraDay });
      }
    }
  }

  const all = [...regular, ...extraItems].sort((a, b) => a.date.localeCompare(b.date));

  return all
    .filter((item) => !completionMap.get(`${item.task.id}:${item.date}`)?.skipped)
    .filter((item) => {
      if (!item.task.deletedAt) return true;
      return completionMap.get(`${item.task.id}:${item.date}`)?.done === true;
    })
    .map((item) => {
      const c = completionMap.get(`${item.task.id}:${item.date}`);
      return {
        taskId: item.task.id,
        title: item.task.title,
        date: item.date,
        startTime: item.task.startTime,
        endTime: item.task.endTime,
        reminder: item.task.reminder,
        done: c?.done ?? false,
        type: item.task.type,
        categoryId: item.task.categoryId,
        category: item.task.category ?? null,
        isMultiDay: item.isMultiDay ?? false,
        multiDayPos: item.multiDayPos ?? null,
        endDate: item.task.endDate ?? null,
        notes: item.task.notes ?? null,
      };
    });
}
