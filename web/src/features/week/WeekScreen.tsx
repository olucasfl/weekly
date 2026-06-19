import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Check, Leaf, CheckCheck, RotateCcw, List, LayoutGrid, CalendarDays, ArrowRight, Trash2, Plus, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { localISO, weekStartOf, addDays } from '../../lib/date';
import { EVENT_COLOR, DAY_NAMES, DAY_NAMES_FULL, MONTH_NAMES_LC } from '../../lib/constants';
import { BottomNav } from '../../components/BottomNav';
import { LogoFull } from '../../components/Logo';
import { TaskRowSkeleton } from '../../components/Skeleton';
import { TimeGridView } from './TimeGridView';
import { MonthView } from './MonthView';

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
  isMultiDay?: boolean;
  multiDayPos?: 'start' | 'middle' | 'end' | null;
  endDate?: string | null;
  notes?: string | null;
};

type AnyTask = {
  id: string;
  title: string;
  type: 'RECURRING' | 'SCHEDULED';
  date?: string | null;
  startTime: string;
  endTime?: string | null;
  notes?: string | null;
  reminder: boolean;
  reminderMin: number;
  categoryId?: string | null;
  category?: { id: string; name: string; color: string } | null;
};

function fmtShort(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}


type ViewMode = 'list' | 'grid' | 'month';

export function WeekScreen() {
  const navigate = useNavigate();
  const today = new Date();
  const [weekStart, setWeekStart]       = useState(() => weekStartOf(today));
  const [selectedDate, setSelectedDate] = useState(() => localISO(today));
  const [viewMode, setViewMode]         = useState<ViewMode>(() => (localStorage.getItem('weekViewMode') as ViewMode) ?? 'list');
  const [toastError, setToastError]     = useState<string | null>(null);
  const [confirmSkip, setConfirmSkip]   = useState<string | null>(null); // taskId being confirmed
  const [showAddExisting, setShowAddExisting] = useState(false);
  const [addExistingTab, setAddExistingTab] = useState<'recurring' | 'events'>('recurring');
  const [addingTaskId, setAddingTaskId] = useState<string | null>(null);

  useEffect(() => { localStorage.setItem('weekViewMode', viewMode); }, [viewMode]);

  const qc = useQueryClient();
  const weekStartISO = localISO(weekStart);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: occurrences = [], isLoading } = useQuery<Occurrence[]>({
    queryKey: ['week', weekStartISO],
    queryFn: () => api(`/week?start=${weekStartISO}`),
  });

  const { data: allRecurring = [], isLoading: loadingRecurring } = useQuery<AnyTask[]>({
    queryKey: ['tasks', 'recurring'],
    queryFn: () => api('/tasks?type=recurring'),
    enabled: showAddExisting,
  });

  const { data: allEvents = [], isLoading: loadingEvents } = useQuery<AnyTask[]>({
    queryKey: ['tasks', 'scheduled'],
    queryFn: () => api('/tasks?type=scheduled'),
    enabled: showAddExisting,
  });

  const loadingAddModal = loadingRecurring || loadingEvents;

  const { data: note } = useQuery<{ date: string; content: string }>({
    queryKey: ['note', selectedDate],
    queryFn: () => api(`/notes?date=${selectedDate}`),
    enabled: viewMode === 'list',
  });

  const noteMutation = useMutation({
    mutationFn: (content: string) =>
      api('/notes', { method: 'PUT', body: JSON.stringify({ date: selectedDate, content }) }),
    onError: () => showError('Erro ao salvar nota. Tente novamente.'),
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
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['week', weekStartISO], ctx.prev);
      showError(err instanceof Error ? err.message : 'Erro ao salvar. O check foi revertido.');
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
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['week', weekStartISO], ctx.prev);
      showError(err instanceof Error ? err.message : 'Erro ao salvar. As alterações foram revertidas.');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['week', weekStartISO] }),
  });

  const skipMutation = useMutation({
    mutationFn: ({ taskId, date }: { taskId: string; date: string }) =>
      api('/completions', { method: 'PATCH', body: JSON.stringify({ taskId, date, skipped: true }) }),
    onMutate: async ({ taskId, date }) => {
      await qc.cancelQueries({ queryKey: ['week', weekStartISO] });
      const prev = qc.getQueryData<Occurrence[]>(['week', weekStartISO]);
      qc.setQueryData<Occurrence[]>(['week', weekStartISO], (old) =>
        old?.filter((o) => !(o.taskId === taskId && o.date === date)) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['week', weekStartISO], ctx.prev);
      showError('Erro ao remover. Tente novamente.');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['week', weekStartISO] }),
  });

  const addExistingMutation = useMutation({
    mutationFn: (task: AnyTask) => {
      setAddingTaskId(task.id);
      return api(`/tasks/${task.id}/extra-days`, {
        method: 'POST',
        body: JSON.stringify({ date: selectedDate }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['week', weekStartISO] });
      setShowAddExisting(false);
      setAddingTaskId(null);
    },
    onError: (e) => {
      setAddingTaskId(null);
      showError(e instanceof Error ? e.message : 'Erro ao adicionar');
    },
  });

  function onToggle(taskId: string, date: string, done: boolean) {
    if ('vibrate' in navigator) navigator.vibrate(30);
    toggleMutation.mutate({ taskId, date, done });
  }

  const dayOccurrences = occurrences
    .filter((o) => o.date === selectedDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const dayTaskIds = new Set(dayOccurrences.map((o) => o.taskId));
  const todayISO = localISO(today);
  const recurringNotOnThisDay = allRecurring.filter((t) => !dayTaskIds.has(t.id));
  const eventsNotOnThisDay = allEvents.filter((t) => !dayTaskIds.has(t.id) && (t.date ?? '') >= todayISO);

  const doneCount = dayOccurrences.filter((o) => o.done).length;
  const isCurrentWeek = localISO(weekStart) === localISO(weekStartOf(today));

  function prevWeek() { const p = addDays(weekStart, -7); setWeekStart(p); setSelectedDate(localISO(p)); }
  function nextWeek() { const n = addDays(weekStart,  7); setWeekStart(n); setSelectedDate(localISO(n)); }
  function goToday()  { setWeekStart(weekStartOf(today)); setSelectedDate(localISO(today)); }

  function handleMonthSelectDay(iso: string) {
    const d = new Date(iso + 'T12:00:00');
    setWeekStart(weekStartOf(d));
    setSelectedDate(iso);
    setViewMode('list');
  }

  const weekEnd   = addDays(weekStart, 6);
  const weekLabel = `${weekStart.getDate()} ${MONTH_NAMES_LC[weekStart.getMonth()]} – ${weekEnd.getDate()} ${MONTH_NAMES_LC[weekEnd.getMonth()]}`;

  return (
    <>
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="screen-header">
        <div className="row-between">
          <div>
            <LogoFull iconSize={22} textSize="sm" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <div className="screen-subtitle">{weekLabel}</div>
              <button
                onClick={() => navigate('/metas')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px 4px 7px',
                  borderRadius: 'var(--r-full)',
                  background: 'var(--brand-grad)',
                  border: 'none', cursor: 'pointer',
                  fontSize: '0.75rem', fontWeight: 700, color: 'white',
                  boxShadow: '0 2px 8px rgba(114,85,224,0.35)',
                  letterSpacing: '0.01em',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <Trophy size={12} strokeWidth={2.2} />
                Metas
              </button>
            </div>
          </div>
          <div className="row" style={{ gap: 4 }}>
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
                  {isToday
                    ? <div className="today-dot" />
                    : <div style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? 'white' : 'var(--brand)', visibility: hasTasks && !isSelected ? 'visible' : 'hidden' }} />
                  }
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Main content ────────────────────────────────────────── */}
      {viewMode === 'grid' && (
        <div style={{ flex: 1, overflow: 'hidden', padding: '8px 0 0' }}>
          <TimeGridView
            occurrences={occurrences}
            weekDays={weekDays}
            today={today}
            filterCatId={null}
            onToggle={onToggle}
          />
        </div>
      )}

      {viewMode === 'month' && (
        <div className="screen-body">
          <MonthView today={today} filterCatId={null} onSelectDay={handleMonthSelectDay} />
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

          {isLoading && [0, 1, 2, 3].map((i) => <TaskRowSkeleton key={i} />)}

          {!isLoading && dayOccurrences.length === 0 && (
            <div className="empty-state">
              <Leaf size={40} strokeWidth={1.2} color="var(--text-muted)" />
              <div className="empty-label">Dia livre</div>
              <div className="empty-hint">Nenhuma tarefa para este dia. Aproveite!</div>
            </div>
          )}

          {dayOccurrences.map((item) => {
            const color = item.category?.color ?? (item.type === 'SCHEDULED' ? EVENT_COLOR : undefined);
            const isConfirming = confirmSkip === item.taskId + item.date;

            if (item.isMultiDay) {
              const isStart = item.multiDayPos === 'start';
              const isEnd = item.multiDayPos === 'end';
              const dateLabel = item.endDate
                ? `${fmtShort(item.date)} ${item.startTime} → ${fmtShort(item.endDate)} ${item.endTime ?? ''}`.trim()
                : item.startTime;
              return (
                <div key={`${item.taskId}-${item.date}`}>
                  {isConfirming ? (
                    <div className="task-row" style={{ gap: 8 }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', flex: 1 }}>Remover deste dia?</span>
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => setConfirmSkip(null)}>Não</button>
                      <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => { skipMutation.mutate({ taskId: item.taskId, date: item.date }); setConfirmSkip(null); }}>Sim</button>
                    </div>
                  ) : (
                    <div
                      className={`task-row multiday-row${item.done ? ' done' : ''}`}
                      style={{ borderLeft: `3px solid ${color ?? EVENT_COLOR}` }}
                      onClick={() => onToggle(item.taskId, item.date, !item.done)}
                    >
                      <div className="task-cat-bar" style={{ background: color ?? EVENT_COLOR, opacity: 0.7 }} />
                      <div className={`task-check${item.done ? ' checked' : ''}`}>
                        <Check size={11} strokeWidth={3} color="white" />
                      </div>
                      <div className="task-info">
                        <div className={`task-name${item.done ? ' done' : ''}`}>{item.title}</div>
                        <div className="task-meta" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isStart ? dateLabel : isEnd ? `→ até ${fmtShort(item.endDate!)} ${item.endTime ?? ''}`.trim() : '· continua'}
                          <span style={{ color: color ?? EVENT_COLOR, fontWeight: 600, marginLeft: 4 }}>
                            · {isStart ? 'início' : isEnd ? 'fim' : 'continua'}
                          </span>
                        </div>
                      </div>
                      <button
                        className="btn-skip"
                        onClick={(e) => { e.stopPropagation(); setConfirmSkip(item.taskId + item.date); }}
                        title="Remover deste dia"
                      >
                        <Trash2 size={13} strokeWidth={1.8} />
                      </button>
                      <ArrowRight size={13} strokeWidth={2} color={color ?? EVENT_COLOR} style={{ opacity: 0.7, flexShrink: 0 }} />
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={`${item.taskId}-${item.date}`}>
                {isConfirming ? (
                  <div className="task-row" style={{ gap: 8 }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', flex: 1 }}>Remover deste dia?</span>
                    <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => setConfirmSkip(null)}>Não</button>
                    <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => { skipMutation.mutate({ taskId: item.taskId, date: item.date }); setConfirmSkip(null); }}>Sim</button>
                  </div>
                ) : (
                  <div
                    className={`task-row${item.done ? ' done' : ''}`}
                    onClick={() => onToggle(item.taskId, item.date, !item.done)}
                  >
                    {(item.category || item.type === 'SCHEDULED') && (
                      <div className="task-cat-bar" style={{ background: color }} />
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
                      {item.notes && <div className="task-notes">{item.notes}</div>}
                    </div>
                    <button
                      className="btn-skip"
                      onClick={(e) => { e.stopPropagation(); setConfirmSkip(item.taskId + item.date); }}
                      title="Remover deste dia"
                    >
                      <Trash2 size={13} strokeWidth={1.8} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add existing task button */}
          {!isLoading && (
            <button
              className="btn btn-ghost"
              style={{ width: '100%', gap: 8, fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}
              onClick={() => { setAddExistingTab('recurring'); setShowAddExisting(true); }}
            >
              <Plus size={14} strokeWidth={2} />
              Adicionar afazer ou evento existente a este dia
            </button>
          )}

          {dayOccurrences.length > 0 && (
            <div className="card-ghost" style={{ marginTop: 4 }}>
              <div className="row-between" style={{ marginBottom: 6 }}>
                <span className="text-xs text-muted">Progresso do dia</span>
                <span className="text-xs font-semibold text-brand">
                  {Math.round((doneCount / dayOccurrences.length) * 100)}%
                </span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${(doneCount / dayOccurrences.length) * 100}%` }} />
              </div>
            </div>
          )}

          {/* Notas do dia */}
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

      {/* Add Existing Modal */}
      {showAddExisting && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAddExisting(false)}>
          <div className="modal">
            <div className="modal-handle" />
            <div className="modal-header">
              <span className="modal-title">Adicionar a {DAY_NAMES_FULL[new Date(selectedDate + 'T12:00:00').getDay()]}</span>
              <button className="modal-close" onClick={() => setShowAddExisting(false)}>✕</button>
            </div>
            {loadingAddModal ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0 8px' }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton" style={{ height: 56, borderRadius: 'var(--r-md)' }} />
                ))}
              </div>
            ) : (<>
            {/* Tab buttons */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {(['recurring', 'events'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAddExistingTab(tab)}
                  style={{
                    flex: 1,
                    padding: '7px 0',
                    borderRadius: 'var(--r-md)',
                    border: addExistingTab === tab ? '1.5px solid var(--brand)' : '1.5px solid var(--border)',
                    background: addExistingTab === tab ? 'var(--brand)' : 'transparent',
                    color: addExistingTab === tab ? '#fff' : 'var(--text-muted)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab === 'recurring' ? 'Afazeres' : 'Eventos'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {addExistingTab === 'recurring' && (
              recurringNotOnThisDay.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                  Todos os seus afazeres já aparecem neste dia.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                  {recurringNotOnThisDay.map((task) => (
                    <button
                      key={task.id}
                      className="task-row"
                      style={{ textAlign: 'left', background: 'none', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', cursor: addExistingMutation.isPending ? 'default' : 'pointer' }}
                      onClick={() => addExistingMutation.mutate(task)}
                      disabled={addExistingMutation.isPending}
                    >
                      {task.category && <div className="task-cat-bar" style={{ background: task.category.color }} />}
                      <div className="task-info">
                        <div className="task-name">{task.title}</div>
                        <div className="task-meta">
                          {task.startTime}{task.endTime ? ` – ${task.endTime}` : ''}
                          {task.category && <span style={{ color: task.category.color, fontWeight: 600, marginLeft: 5 }}>· {task.category.name}</span>}
                        </div>
                      </div>
                      {addingTaskId === task.id
                        ? <div className="spinner" style={{ width: 14, height: 14, flexShrink: 0 }} />
                        : <Plus size={14} color="var(--brand)" style={{ flexShrink: 0, opacity: addExistingMutation.isPending ? 0.3 : 1 }} />
                      }
                    </button>
                  ))}
                </div>
              )
            )}

            {addExistingTab === 'events' && (
              eventsNotOnThisDay.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                  Nenhum evento de hoje em diante disponível.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                  {eventsNotOnThisDay.map((task) => (
                    <button
                      key={task.id}
                      className="task-row"
                      style={{ textAlign: 'left', background: 'none', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', cursor: addExistingMutation.isPending ? 'default' : 'pointer' }}
                      onClick={() => addExistingMutation.mutate(task)}
                      disabled={addExistingMutation.isPending}
                    >
                      <div className="task-cat-bar" style={{ background: task.category?.color ?? EVENT_COLOR }} />
                      <div className="task-info">
                        <div className="task-name">{task.title}</div>
                        <div className="task-meta">
                          {task.startTime}{task.endTime ? ` – ${task.endTime}` : ''}
                          {task.category && <span style={{ color: task.category.color, fontWeight: 600, marginLeft: 5 }}>· {task.category.name}</span>}
                        </div>
                      </div>
                      {addingTaskId === task.id
                        ? <div className="spinner" style={{ width: 14, height: 14, flexShrink: 0 }} />
                        : <Plus size={14} color="var(--brand)" style={{ flexShrink: 0, opacity: addExistingMutation.isPending ? 0.3 : 1 }} />
                      }
                    </button>
                  ))}
                </div>
              )
            )}
            </>)}
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
