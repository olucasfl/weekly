import { buildWeekOccurrences, type TaskLike, type OccurrenceItem } from '../../../../shared/src/recurrence.js';
import { getCompletionsForRange, getStepCompletionsForRange } from '../completions/completions.service.js';
import { getStepsForTaskIds } from '../tasks/tasks.service.js';

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function getWeekOccurrences(userId: string, tasks: TaskLike[], weekStart: string) {
  const weekEnd = offsetDate(weekStart, 6);
  const todayISO = new Date().toISOString().slice(0, 10);
  const [completions, stepDefs, stepCompletions] = await Promise.all([
    getCompletionsForRange(userId, weekStart, weekEnd),
    getStepsForTaskIds(tasks.map((t) => t.id)),
    getStepCompletionsForRange(userId, weekStart, weekEnd),
  ]);
  const completionMap = new Map(completions.map((c) => [`${c.taskId}:${c.date}`, c]));

  const stepsByTask = new Map<string, { id: string; title: string }[]>();
  for (const s of stepDefs) {
    const list = stepsByTask.get(s.taskId) ?? [];
    list.push({ id: s.id, title: s.title });
    stepsByTask.set(s.taskId, list);
  }
  const stepDoneMap = new Map(stepCompletions.map((sc) => [`${sc.taskStepId}:${sc.date}`, sc.done]));

  const regular = buildWeekOccurrences(tasks, weekStart, todayISO);

  // Extra occurrences handled here so tsx watch picks it up (shared/ may not be watched)
  const extraItems: OccurrenceItem[] = [];
  for (const task of tasks) {
    if (task.active === false) continue;
    for (const extraDay of task.extraDays ?? []) {
      if (extraDay < weekStart || extraDay > weekEnd) continue;
      if (task.deletedAt && extraDay > task.deletedAt) continue;
      if (task.pausedUntil && extraDay >= todayISO && extraDay <= task.pausedUntil) continue;
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
      const taskSteps = stepsByTask.get(item.task.id);
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
        steps: taskSteps && taskSteps.length > 0
          ? taskSteps.map((s) => ({ id: s.id, title: s.title, done: stepDoneMap.get(`${s.id}:${item.date}`) ?? false }))
          : undefined,
      };
    });
}
