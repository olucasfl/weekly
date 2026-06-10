import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Check, Leaf, CheckCheck, RotateCcw, List, LayoutGrid, CalendarDays } from 'lucide-react';
import { api } from '../../lib/api';
import { localISO, mondayOf, addDays } from '../../lib/date';
import { BottomNav } from '../../components/BottomNav';
import { LogoFull } from '../../components/Logo';
import { TimeGridView } from './TimeGridView';
import { MonthView } from './MonthView';

const EVENT_COLOR = '#f43f5e';

type Occurrence = {
  taskId: string;
  title: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  done: boolean;
  type?: string;
  categoryId?: string;
  category?: { id: string; name: string; color: string } | null;
};

type Category = { id: string; name: string; color: string };

const DAY_NAMES      = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAY_NAMES_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTH_NAMES    = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

type ViewMode = 'list' | 'grid' | 'month';

export function WeekScreen() {
  const today = new Date();
  const [weekStart, setWeekStart]       = useState(() => mondayOf(today));
  const [selectedDate, setSelectedDate] = useState(() => localISO(today));
  const [viewMode, setViewMode]         = useState<ViewMode>(() => (localStorage.getItem('weekViewMode') as ViewMode) ?? 'list');
  const [filterCatId, setFilterCatId]   = useState<string | null>(null);
  const [toastError, setToastError]     = useState<string | null>(null);

  useEffect(() => { localStorage.setItem('weekViewMode', viewMode); }, [viewMode]);

  const qc = useQueryClient();
  const weekStartISO = localISO(weekStart);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: occurrences = [], isLoading } = useQuery<Occurrence[]>({
    queryKey: ['week', weekStartISO],
    queryFn: () => api(`/week?start=${weekStartISO}`),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api('/categories'),
  });

  const { data: note } = useQuery<{ date: string; content: string }>({
    queryKey: ['note', selectedDate],
    queryFn: () => api(`/notes?date=${selectedDate}`),
    enabled: viewMode === 'list',
  });

  const noteMutation = useMutation({
    mutationFn: (content: string) =>
      api('/notes', { method: 'PUT', body: JSON.stringify({ date: selectedDate, content }) }),
  });

  const [noteText, setNoteText] = useState('');
  useEffect(() => { setNoteText(note?.content ?? ''); }, [note?.content, selectedDate]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleNoteChange(v: string) {
    setNoteText(v);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => noteMutation.mutate(v), 800);
  }

  function showError(msg: string) {
    setToastError(msg);
    setTimeout(() => setToastError(null), 3500);
  }

  const toggleMutation = useMutation({
    mutationFn: ({ taskId, date, done }: { taskId: string; date: string; done: boolean }) =>
      api('/completions', { method: 'PUT', body: JSON.stringify({ taskId, date, done }) }),
    onMutate: async ({ taskId, date, done }) => {
      await qc.cancelQueries({ queryKey: ['week', weekStartISO] });
      const prev = qc.getQueryData<Occurrence[]>(['week', weekStartISO]);
      qc.setQueryData<Occurrence[]>(['week', weekStartISO], (old) =>
        old?.map((o) => o.taskId === taskId && o.date === date ? { ...o, done } : o) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['week', weekStartISO], ctx.prev);
      showError('Erro ao salvar. O check foi revertido.');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['week', weekStartISO] }),
  });

  const bulkMutation = useMutation({
    mutationFn: ({ taskIds, date, done }: { taskIds: string[]; date: string; done: boolean }) =>
      Promise.all(taskIds.map((taskId) =>
        api('/completions', { method: 'PUT', body: JSON.stringify({ taskId, date, done }) })
      )),
    onMutate: async ({ taskIds, date, done }) => {
      await qc.cancelQueries({ queryKey: ['week', weekStartISO] });
      const prev = qc.getQueryData<Occurrence[]>(['week', weekStartISO]);
      qc.setQueryData<Occurrence[]>(['week', weekStartISO], (old) =>
        old?.map((o) => taskIds.includes(o.taskId) && o.date === date ? { ...o, done } : o) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['week', weekStartISO], ctx.prev);
      showError('Erro ao salvar. As alterações foram revertidas.');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['week', weekStartISO] }),
  });

  function onToggle(taskId: string, date: string, done: boolean) {
    toggleMutation.mutate({ taskId, date, done });
  }

  const dayOccurrences = occurrences
    .filter((o) => o.date === selectedDate)
    .filter((o) => !filterCatId || o.category?.id === filterCatId)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const doneCount = dayOccurrences.filter((o) => o.done).length;
  const isCurrentWeek = localISO(weekStart) === localISO(mondayOf(today));

  function prevWeek() { const p = addDays(weekStart, -7); setWeekStart(p); setSelectedDate(localISO(p)); }
  function nextWeek() { const n = addDays(weekStart,  7); setWeekStart(n); setSelectedDate(localISO(n)); }
  function goToday()  { setWeekStart(mondayOf(today)); setSelectedDate(localISO(today)); }

  function handleMonthSelectDay(iso: string) {
    const d = new Date(iso + 'T12:00:00');
    setWeekStart(mondayOf(d));
    setSelectedDate(iso);
    setViewMode('list');
  }

  const weekEnd   = addDays(weekStart, 6);
  const weekLabel = `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()]} – ${weekEnd.getDate()} ${MONTH_NAMES[weekEnd.getMonth()]}`;

  return (
    <>
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="screen-header">
        <div className="row-between">
          <div>
            <LogoFull iconSize={22} textSize="sm" />
            <div className="screen-subtitle" style={{ marginTop: 2 }}>{weekLabel}</div>
          </div>
          <div className="row" style={{ gap: 4 }}>
            {/* View mode toggle */}
            <div className="view-mode-tabs">
              {([['list', List], ['grid', LayoutGrid], ['month', CalendarDays]] as const).map(([mode, Icon]) => (
                <button
                  key={mode}
                  className={`view-mode-btn${viewMode === mode ? ' active' : ''}`}
                  onClick={() => setViewMode(mode)}
                  title={mode === 'list' ? 'Lista' : mode === 'grid' ? 'Horários' : 'Mês'}
                >
                  <Icon size={15} strokeWidth={1.8} />
                </button>
              ))}
            </div>
            {viewMode !== 'month' && (
              <>
                {!isCurrentWeek && (
                  <button className="pill pill-sm" onClick={goToday} style={{ cursor: 'pointer', border: 'none' }}>Hoje</button>
                )}
                <button className="btn btn-icon" onClick={prevWeek}><ChevronLeft size={16} /></button>
                <button className="btn btn-icon" onClick={nextWeek}><ChevronRight size={16} /></button>
              </>
            )}
          </div>
        </div>

        {/* Day strip — only in list mode */}
        {viewMode === 'list' && (
          <div className="day-strip" style={{ marginTop: 10 }}>
            {weekDays.map((d) => {
              const iso = localISO(d);
              const isToday = iso === localISO(today);
              const isSelected = iso === selectedDate;
              const hasTasks = occurrences.some((o) => o.date === iso);
              return (
                <button
                  key={iso}
                  className={`day-btn${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`}
                  onClick={() => setSelectedDate(iso)}
                >
                  <span className="day-name">{DAY_NAMES[d.getDay()]}</span>
                  <span className="day-num">{d.getDate()}</span>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? 'white' : 'var(--brand)', visibility: hasTasks && !isSelected ? 'visible' : 'hidden' }} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Category filter (list + grid modes) ────────────────── */}
      {viewMode !== 'month' && categories.length > 0 && (
        <div style={{ padding: '10px 16px 0' }}>
          <div className="cat-chips-row">
            <button
              className={`cat-chip${!filterCatId ? ' active-filter' : ''}`}
              onClick={() => setFilterCatId(null)}
              style={!filterCatId ? { borderColor: 'var(--brand)', background: 'var(--brand-light)', color: 'var(--brand)' } : {}}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                className="cat-chip"
                style={filterCatId === cat.id ? { borderColor: cat.color, background: `${cat.color}18`, color: cat.color } : {}}
                onClick={() => setFilterCatId(filterCatId === cat.id ? null : cat.id)}
              >
                <div className="cat-dot" style={{ background: cat.color }} />
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Main content ────────────────────────────────────────── */}
      {viewMode === 'grid' && (
        <div style={{ flex: 1, overflow: 'hidden', padding: '8px 0 0' }}>
          <TimeGridView
            occurrences={occurrences}
            weekDays={weekDays}
            today={today}
            filterCatId={filterCatId}
            onToggle={onToggle}
          />
        </div>
      )}

      {viewMode === 'month' && (
        <div className="screen-body">
          <MonthView today={today} filterCatId={filterCatId} onSelectDay={handleMonthSelectDay} />
        </div>
      )}

      {viewMode === 'list' && (
        <div className="screen-body">
          {/* Day title + bulk actions */}
          <div className="row-between" style={{ padding: '4px 0' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {DAY_NAMES_FULL[new Date(selectedDate + 'T12:00:00').getDay()]}
              {selectedDate === localISO(today) && <span className="pill pill-sm" style={{ marginLeft: 8 }}>Hoje</span>}
            </span>
            {dayOccurrences.length > 0 && (
              <div className="row" style={{ gap: 6 }}>
                <button
                  className="btn-bulk"
                  title="Marcar todos"
                  disabled={doneCount === dayOccurrences.length || bulkMutation.isPending}
                  onClick={() => bulkMutation.mutate({ taskIds: dayOccurrences.filter((o) => !o.done).map((o) => o.taskId), date: selectedDate, done: true })}
                >
                  <CheckCheck size={14} strokeWidth={2} />
                </button>
                <button
                  className="btn-bulk"
                  title="Desmarcar todos"
                  disabled={doneCount === 0 || bulkMutation.isPending}
                  onClick={() => bulkMutation.mutate({ taskIds: dayOccurrences.filter((o) => o.done).map((o) => o.taskId), date: selectedDate, done: false })}
                >
                  <RotateCcw size={13} strokeWidth={2} />
                </button>
                <span className="text-sm text-muted">{doneCount}/{dayOccurrences.length} feito{doneCount !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {isLoading && <div className="spinner" />}

          {!isLoading && dayOccurrences.length === 0 && (
            <div className="empty-state">
              <Leaf size={40} strokeWidth={1.2} color="var(--text-muted)" />
              <div className="empty-label">Dia livre</div>
              <div className="empty-hint">Nenhuma tarefa para este dia. Aproveite!</div>
            </div>
          )}

          {dayOccurrences.map((item) => (
            <div
              key={`${item.taskId}-${item.date}`}
              className={`task-row${item.done ? ' done' : ''}`}
              onClick={() => onToggle(item.taskId, item.date, !item.done)}
            >
              {(item.category || item.type === 'SCHEDULED') && (
                <div className="task-cat-bar" style={{ background: item.category?.color ?? EVENT_COLOR }} />
              )}
              <div className={`task-check${item.done ? ' checked' : ''}`}>
                <Check size={11} strokeWidth={3} color="white" />
              </div>
              <div className="task-info">
                <div className={`task-name${item.done ? ' done' : ''}`}>{item.title}</div>
                <div className="task-meta">
                  {item.startTime}{item.endTime ? ` – ${item.endTime}` : ''}
                  {item.category ? (
                    <span style={{ color: item.category.color, fontWeight: 600, marginLeft: 5 }}>· {item.category.name}</span>
                  ) : item.type === 'SCHEDULED' ? (
                    <span style={{ color: EVENT_COLOR, fontWeight: 600, marginLeft: 5 }}>· Evento</span>
                  ) : null}
                </div>
              </div>
            </div>
          ))}

          {dayOccurrences.length > 0 && (
            <div className="card-ghost" style={{ marginTop: 4 }}>
              <div className="row-between" style={{ marginBottom: 6 }}>
                <span className="text-xs text-muted">Progresso do dia</span>
                <span className="text-xs font-semibold text-brand">
                  {dayOccurrences.length > 0 ? Math.round((doneCount / dayOccurrences.length) * 100) : 0}%
                </span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${dayOccurrences.length > 0 ? (doneCount / dayOccurrences.length) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {/* ─── Notas do dia ───────────────────────────────────── */}
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Notas
            </div>
            <textarea
              className="note-area"
              placeholder="Anote algo sobre este dia…"
              value={noteText}
              onChange={(e) => handleNoteChange(e.target.value)}
            />
          </div>
        </div>
      )}

      {toastError && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#ef4444', color: '#fff', borderRadius: 10, padding: '10px 18px',
          fontSize: '0.85rem', fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {toastError}
        </div>
      )}

      <BottomNav />
    </>
  );
}
