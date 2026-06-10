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

export function buildWeekOccurrences(tasks: TaskLike[], weekStart: string): OccurrenceItem[] {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const occurrences: OccurrenceItem[] = [];

  for (const task of tasks.filter((t) => t.active !== false)) {
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
            occurrences.push({ task, date: dateStr, isMultiDay: true, multiDayPos });
          }
        }
      } else {
        const d = new Date(task.date + 'T00:00:00');
        if (d >= start && d <= end) {
          occurrences.push({ task, date: task.date });
        }
      }
      continue;
    }

    if (task.type !== 'RECURRING') continue;

    const rtype = task.recurrenceType ?? 'weekly';

    if (rtype === 'weekly') {
      for (const weekday of task.weekdays) {
        const current = new Date(start);
        const dayOffset = (weekday - start.getDay() + 7) % 7;
        current.setDate(start.getDate() + dayOffset);
        if (current >= start && current <= end) {
          occurrences.push({ task, date: current.toISOString().slice(0, 10) });
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
          if (current >= start && current <= end) {
            occurrences.push({ task, date: current.toISOString().slice(0, 10) });
          }
        }
      }
    } else if (rtype === 'monthly_date' && task.monthlyDay != null) {
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        if (d.getDate() === task.monthlyDay) {
          occurrences.push({ task, date: d.toISOString().slice(0, 10) });
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
          if (matches) occurrences.push({ task, date: d.toISOString().slice(0, 10) });
          break;
        }
      }
    }
  }

  return occurrences.sort((a, b) => a.date.localeCompare(b.date));
}
