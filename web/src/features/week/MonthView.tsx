import { useQueries } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../lib/api';
import { addDays, localISO, mondayOf } from '../../lib/date';
import { EVENT_COLOR, MONTH_NAMES_FULL } from '../../lib/constants';

const DAY_ABBR = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

type Occurrence = {
  taskId: string;
  title: string;
  date: string;
  startTime: string;
  done: boolean;
  type?: string;
  category?: { id: string; name: string; color: string } | null;
};

interface Props {
  today: Date;
  filterCatId: string | null;
  onSelectDay: (date: string) => void;
}

function getMonthWeekStarts(year: number, month: number): string[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const starts: string[] = [];
  let cur = mondayOf(firstDay);
  while (cur <= lastDay) {
    starts.push(localISO(cur));
    cur = addDays(cur, 7);
  }
  return starts;
}

function buildCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Week starts Monday; (0=Sun → 6 in Mon-based)
  const startPad = (firstDay.getDay() + 6) % 7;
  const days: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

export function MonthView({ today, filterCatId, onSelectDay }: Props) {
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const weekStarts = getMonthWeekStarts(year, month);

  const queries = useQueries({
    queries: weekStarts.map((ws) => ({
      queryKey: ['week', ws],
      queryFn: () => api<Occurrence[]>(`/week?start=${ws}`),
      staleTime: 30_000,
    })),
  });

  const allOccs: Occurrence[] = queries.flatMap((q) => q.data ?? []);
  const filtered = filterCatId ? allOccs.filter((o) => o.category?.id === filterCatId) : allOccs;

  const occsByDate = new Map<string, Occurrence[]>();
  for (const o of filtered) {
    const arr = occsByDate.get(o.date) ?? [];
    arr.push(o);
    occsByDate.set(o.date, arr);
  }

  const calDays = buildCalendarDays(year, month);
  const todayISO = localISO(today);

  function prevMonth() { setViewMonth(new Date(year, month - 1, 1)); }
  function nextMonth() { setViewMonth(new Date(year, month + 1, 1)); }

  return (
    <div className="month-view">
      {/* Month navigation */}
      <div className="month-nav">
        <button className="btn-bulk" onClick={prevMonth}><ChevronLeft size={15} /></button>
        <span className="month-title">{MONTH_NAMES_FULL[month]} {year}</span>
        <button className="btn-bulk" onClick={nextMonth}><ChevronRight size={15} /></button>
      </div>

      {/* Day of week headers */}
      <div className="month-grid-header">
        {DAY_ABBR.map((d) => (
          <div key={d} className="month-dow">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="month-grid">
        {calDays.map((d, i) => {
          if (!d) return <div key={`pad-${i}`} className="month-cell empty" />;
          const iso = localISO(d);
          const occs = occsByDate.get(iso) ?? [];
          const isToday = iso === todayISO;
          const isCurrentMonth = d.getMonth() === month;
          const dots = occs.slice(0, 3);
          const extra = occs.length - 3;

          return (
            <div
              key={iso}
              className={`month-cell${isToday ? ' today' : ''}${!isCurrentMonth ? ' other-month' : ''}`}
              onClick={() => onSelectDay(iso)}
            >
              <div className={`month-cell-num${isToday ? ' today' : ''}`}>{d.getDate()}</div>
              {dots.length > 0 && (
                <div className="month-dots">
                  {dots.map((o) => (
                    <div
                      key={o.taskId}
                      className="month-dot"
                      style={{ background: o.category?.color ?? (o.type === 'SCHEDULED' ? EVENT_COLOR : 'var(--brand)') }}
                    />
                  ))}
                  {extra > 0 && <span className="month-dot-extra">+{extra}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
