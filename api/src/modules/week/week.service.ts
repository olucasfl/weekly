import { buildWeekOccurrences, type TaskLike } from '../../../../shared/src/recurrence.js';
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

  return buildWeekOccurrences(tasks, weekStart)
    .filter((item) => !completionMap.get(`${item.task.id}:${item.date}`)?.skipped)
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
      };
    });
}
