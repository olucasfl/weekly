export type TaskLike = {
  id: string;
  title: string;
  type: 'RECURRING' | 'SCHEDULED';
  weekdays: number[];
  date?: string;
  endDate?: string | null;
  startTime: string;
  endTime?: string;
  reminder?: boolean;
  reminderMin?: number;
  active?: boolean;
  categoryId?: string;
  category?: { id: string; name: string; color: string } | null;
  recurrenceType?: string;
  biweeklyAnchor?: string | null;
  monthlyDay?: number | null;
  monthlyWeekday?: number | null;
  monthlyWeek?: number | null;
  yearlyMonth?: number | null;
  deletedAt?: string | null;
  notes?: string | null;
  extraDays?: string[];
};

export type OccurrenceItem = {
  task: TaskLike;
  date: string;
  isMultiDay?: boolean;
  multiDayPos?: 'start' | 'middle' | 'end';
};

function mondayOfDate(dateStr: string): Date {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() - (day + 6) % 7);
  return d;
}

function notDeleted(deletedDate: string | null, occurrenceDate: string): boolean {
  if (!deletedDate) return true;
  return occurrenceDate <= deletedDate;
}

export function buildWeekOccurrences(tasks: TaskLike[], weekStart: string): OccurrenceItem[] {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const occurrences: OccurrenceItem[] = [];

  for (const task of tasks.filter((t) => t.active !== false)) {
    const deletedDate = task.deletedAt ?? null;
    if (task.type === 'SCHEDULED' && task.date) {
      if (task.endDate) {
        // Multi-day event: one occurrence per day in the span that falls within the week
        const eventStart = new Date(task.date + 'T00:00:00');
        const eventEnd = new Date(task.endDate + 'T00:00:00');
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (d >= eventStart && d <= eventEnd) {
            const dateStr = d.toISOString().slice(0, 10);
            let multiDayPos: 'start' | 'middle' | 'end';
            if (dateStr === task.date) multiDayPos = 'start';
            else if (dateStr === task.endDate) multiDayPos = 'end';
            else multiDayPos = 'middle';
            if (notDeleted(deletedDate, dateStr))
              occurrences.push({ task, date: dateStr, isMultiDay: true, multiDayPos });
          }
        }
      } else {
        const d = new Date(task.date + 'T00:00:00');
        if (d >= start && d <= end && notDeleted(deletedDate, task.date)) {
          occurrences.push({ task, date: task.date });
        }
      }
      continue;
    }

    if (task.type !== 'RECURRING') continue;

    const rtype = task.recurrenceType ?? 'weekly';
    const taskStartDate = task.date ?? null; // date = start date for recurring tasks

    if (rtype === 'weekly') {
      for (const weekday of task.weekdays) {
        const current = new Date(start);
        const dayOffset = (weekday - start.getDay() + 7) % 7;
        current.setDate(start.getDate() + dayOffset);
        const dateStr = current.toISOString().slice(0, 10);
        if (current >= start && current <= end && notDeleted(deletedDate, dateStr)
          && (!taskStartDate || dateStr >= taskStartDate)) {
          occurrences.push({ task, date: dateStr });
        }
      }
    } else if (rtype === 'biweekly' && task.biweeklyAnchor) {
      const anchorMonday = mondayOfDate(task.biweeklyAnchor);
      const currentMonday = new Date(weekStart + 'T12:00:00');
      const weeksDiff = Math.round(
        (currentMonday.getTime() - anchorMonday.getTime()) / (7 * 24 * 60 * 60 * 1000),
      );
      if (Math.abs(weeksDiff) % 2 === 0) {
        for (const weekday of task.weekdays) {
          const current = new Date(start);
          const dayOffset = (weekday - start.getDay() + 7) % 7;
          current.setDate(start.getDate() + dayOffset);
          const dateStr = current.toISOString().slice(0, 10);
          if (current >= start && current <= end && notDeleted(deletedDate, dateStr)
            && (!taskStartDate || dateStr >= taskStartDate)) {
            occurrences.push({ task, date: dateStr });
          }
        }
      }
    } else if (rtype === 'monthly_date' && task.monthlyDay != null) {
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const dateStr = d.toISOString().slice(0, 10);
        if (d.getDate() === task.monthlyDay && notDeleted(deletedDate, dateStr)
          && (!taskStartDate || dateStr >= taskStartDate)) {
          occurrences.push({ task, date: dateStr });
          break;
        }
      }
    } else if (rtype === 'yearly' && task.monthlyDay != null && task.yearlyMonth != null) {
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const dateStr = d.toISOString().slice(0, 10);
        if (d.getMonth() + 1 === task.yearlyMonth && d.getDate() === task.monthlyDay
          && notDeleted(deletedDate, dateStr)
          && (!taskStartDate || dateStr >= taskStartDate)) {
          occurrences.push({ task, date: dateStr });
          break;
        }
      }
    } else if (rtype === 'monthly_weekday' && task.monthlyWeekday != null && task.monthlyWeek != null) {
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        if (d.getDay() === task.monthlyWeekday) {
          let matches = false;
          if (task.monthlyWeek === -1) {
            const nextWeek = new Date(d);
            nextWeek.setDate(d.getDate() + 7);
            matches = nextWeek.getMonth() !== d.getMonth();
          } else {
            matches = Math.ceil(d.getDate() / 7) === task.monthlyWeek;
          }
          const dateStr = d.toISOString().slice(0, 10);
          if (matches && notDeleted(deletedDate, dateStr)
            && (!taskStartDate || dateStr >= taskStartDate)) occurrences.push({ task, date: dateStr });
          break;
        }
      }
    }
  }

  // Extra occurrences manually added to specific days
  for (const task of tasks.filter((t) => t.active !== false)) {
    const deletedDate = task.deletedAt ?? null;
    for (const extraDay of task.extraDays ?? []) {
      const d = new Date(extraDay + 'T00:00:00');
      if (d >= start && d <= end && notDeleted(deletedDate, extraDay)) {
        if (!occurrences.some((o) => o.task.id === task.id && o.date === extraDay)) {
          occurrences.push({ task, date: extraDay });
        }
      }
    }
  }

  return occurrences.sort((a, b) => a.date.localeCompare(b.date));
}
