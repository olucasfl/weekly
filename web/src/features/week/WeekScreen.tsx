import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Check, Leaf, CheckCheck, RotateCcw, List, LayoutGrid, CalendarDays, ArrowRight, Trash2, Plus, Repeat } from 'lucide-react';
import { api } from '../../lib/api';
import { localISO, weekStartOf, addDays } from '../../lib/date';
import { EVENT_COLOR, DAY_NAMES, DAY_NAMES_FULL, MONTH_NAMES_LC } from '../../lib/constants';
import { AppNav } from '../../components/AppNav';
import { LogoFull } from '../../components/Logo';
import { TaskRowSkeleton } from '../../components/Skeleton';
import { TimeGridView } from './TimeGridView';
import { MonthView } from './MonthView';
import { TaskModal } from '../tasks/TasksScreen';
import { EventModal } from '../events/EventsScreen';
import { WeekGoalsCard } from '../goals/GoalsCard';

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
  steps?: { id: string; title: string; done: boolean }[];
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
  const today = new Date();
  const [weekStart, setWeekStart]       = useState(() => weekStartOf(today));
  const [selectedDate, setSelectedDate] = useState(() => localISO(today));
  const [viewMode, setViewMode]         = useState<ViewMode>(() => (localStorage.getItem('weekViewMode') as ViewMode) ?? 'list');
  const [toastError, setToastError]     = useState<string | null>(null);
  const [confirmSkip, setConfirmSkip]   = useState<string | null>(null); // taskId being confirmed
  const [sheetStep, setSheetStep] = useState<'closed' | 'choose' | 'existing'>('closed');
  const [addExistingTab, setAddExistingTab] = useState<'recurring' | 'events'>('recurring');
  const [addingTaskId, setAddingTaskId] = useState<string | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [expandedChecklist, setExpandedChecklist] = useState<Record<string, boolean>>({});
  const showAddExisting = sheetStep !== 'closed';

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

  const { data: categories = [] } = useQuery<{ id: string; name: string; color: string }[]>({
    queryKey: ['categories'],
    queryFn: () => api('/categories'),
    enabled: showTaskModal,
  });

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
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['week', weekStartISO] });
      // Concluir uma rotina pode ter avançado uma meta vinculada por categoria (ver
      // completions.service.ts) — refetch pro card de metas refletir na hora.
      qc.invalidateQueries({ queryKey: ['goals', weekStartISO] });
      // Refetch da tela de Progresso, senão ela fica mostrando o percentual antigo
      // até o staleTime global (30s) expirar sozinho.
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const bulkMutation = useMutation({
    // Itens com checklist não passam por PUT /completions direto (o backend exige todas as
    // etapas concluídas primeiro) — pra "marcar todos" completar eles também, marca cada etapa.
    mutationFn: ({ items, date, done }: { items: Occurrence[]; date: string; done: boolean }) =>
      Promise.all(items.map((item) => {
        if (done && item.steps && item.steps.length > 0) {
          return Promise.all(item.steps.map((s) =>
            api(`/tasks/${item.taskId}/steps/${s.id}/completion`, { method: 'PUT', body: JSON.stringify({ date, done: true }) })
          ));
        }
        return api('/completions', { method: 'PUT', body: JSON.stringify({ taskId: item.taskId, date, done }) });
      })),
    onMutate: async ({ items, date, done }) => {
      await qc.cancelQueries({ queryKey: ['week', weekStartISO] });
      const prev = qc.getQueryData<Occurrence[]>(['week', weekStartISO]);
      const ids = new Set(items.map((i) => i.taskId));
      qc.setQueryData<Occurrence[]>(['week', weekStartISO], (old) =>
        old?.map((o) => ids.has(o.taskId) && o.date === date
          ? { ...o, done, steps: o.steps ? o.steps.map((s) => ({ ...s, done })) : o.steps }
          : o
        ) ?? []
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['week', weekStartISO], ctx.prev);
      showError(err instanceof Error ? err.message : 'Erro ao salvar. As alterações foram revertidas.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['week', weekStartISO] });
      qc.invalidateQueries({ queryKey: ['goals', weekStartISO] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const toggleStepMutation = useMutation({
    mutationFn: ({ taskId, stepId, date, done }: { taskId: string; stepId: string; date: string; done: boolean }) =>
      api(`/tasks/${taskId}/steps/${stepId}/completion`, { method: 'PUT', body: JSON.stringify({ date, done }) }),
    onMutate: async ({ taskId, stepId, date, done }) => {
      await qc.cancelQueries({ queryKey: ['week', weekStartISO] });
      const prev = qc.getQueryData<Occurrence[]>(['week', weekStartISO]);
      qc.setQueryData<Occurrence[]>(['week', weekStartISO], (old) =>
        old?.map((o) => {
          if (o.taskId !== taskId || o.date !== date || !o.steps) return o;
          const steps = o.steps.map((s) => (s.id === stepId ? { ...s, done } : s));
          return { ...o, steps, done: steps.every((s) => s.done) };
        }) ?? []
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['week', weekStartISO], ctx.prev);
      showError(err instanceof Error ? err.message : 'Erro ao marcar etapa. Tente novamente.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['week', weekStartISO] });
      qc.invalidateQueries({ queryKey: ['goals', weekStartISO] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
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
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['week', weekStartISO] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const deleteRoutineMutation = useMutation({
    mutationFn: (taskId: string) => api(`/tasks/${taskId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['week', weekStartISO] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => showError('Erro ao apagar. Tente novamente.'),
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
      setSheetStep('closed');
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

  function onToggleStep(taskId: string, date: string, stepId: string, done: boolean, allSteps: { id: string; done: boolean }[]) {
    if ('vibrate' in navigator) navigator.vibrate(20);
    toggleStepMutation.mutate({ taskId, stepId, date, done });
    // Se essa marcação completa o checklist inteiro, recolhe a lista de etapas sozinha logo
    // depois — a ocorrência já assume o visual "feita" e a lista não fica aberta à toa.
    const willAllBeDone = done && allSteps.every((s) => s.id === stepId || s.done);
    if (willAllBeDone) {
      const key = `${taskId}:${date}`;
      setTimeout(() => setExpandedChecklist((c) => ({ ...c, [key]: false })), 700);
    }
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
            <div className="screen-subtitle" style={{ marginTop: 2 }}>{weekLabel}</div>
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

      <div style={{ padding: '10px 20px 0' }}>
        <WeekGoalsCard weekStartISO={weekStartISO} />
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
            isLoading={isLoading}
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
                  onClick={() => bulkMutation.mutate({ items: dayOccurrences.filter((o) => !o.done), date: selectedDate, done: true })}
                >
                  <CheckCheck size={14} strokeWidth={2} />
                </button>
                <button
                  className="btn-bulk"
                  title="Desmarcar todos"
                  disabled={doneCount === 0 || bulkMutation.isPending}
                  onClick={() => bulkMutation.mutate({ items: dayOccurrences.filter((o) => o.done), date: selectedDate, done: false })}
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
            const hasSteps = !item.isMultiDay && !!item.steps && item.steps.length > 0;
            const stepsDone = item.steps?.filter((s) => s.done).length ?? 0;
            const stepsTotal = item.steps?.length ?? 0;
            const checklistKey = `${item.taskId}:${item.date}`;
            const isChecklistExpanded = !!expandedChecklist[checklistKey];

            if (item.isMultiDay) {
              const isStart = item.multiDayPos === 'start';
              const isEnd = item.multiDayPos === 'end';
              const dateLabel = item.endDate
                ? `${fmtShort(item.date)} ${item.startTime} → ${fmtShort(item.endDate)} ${item.endTime ?? ''}`.trim()
                : item.startTime;
              return (
                <div key={`${item.taskId}-${item.date}`}>
                  {isConfirming ? (
                    <div className="task-row" style={{ gap: 8, flexWrap: 'wrap', rowGap: 6 }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', flex: '1 1 160px' }}>
                        {item.type === 'RECURRING' ? 'Remover só esse dia ou a rotina toda?' : 'Remover deste dia?'}
                      </span>
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => setConfirmSkip(null)}>Não</button>
                      {item.type === 'RECURRING' ? (
                        <>
                          <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => { skipMutation.mutate({ taskId: item.taskId, date: item.date }); setConfirmSkip(null); }}>Só hoje</button>
                          <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => { deleteRoutineMutation.mutate(item.taskId); setConfirmSkip(null); }}>Rotina toda</button>
                        </>
                      ) : (
                        <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => { skipMutation.mutate({ taskId: item.taskId, date: item.date }); setConfirmSkip(null); }}>Sim</button>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`task-row multiday-row${item.done ? ' done' : ''}`}
                      style={{ borderLeft: `3px solid ${color ?? EVENT_COLOR}` }}
                    >
                      <div className="task-cat-bar" style={{ background: color ?? EVENT_COLOR, opacity: 0.7 }} />
                      <button
                        className={`task-check${item.done ? ' checked' : ''}`}
                        style={{ touchAction: 'manipulation' }}
                        onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(item.taskId, item.date, !item.done); }}
                        onClick={() => onToggle(item.taskId, item.date, !item.done)}
                        aria-label={item.done ? 'Desmarcar' : 'Marcar como feito'}
                      >
                        <Check size={11} strokeWidth={3} color="white" />
                      </button>
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
                  <div className="task-row" style={{ gap: 8, flexWrap: 'wrap', rowGap: 6 }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', flex: '1 1 160px' }}>
                      {item.type === 'RECURRING' ? 'Remover só esse dia ou a rotina toda?' : 'Remover deste dia?'}
                    </span>
                    <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => setConfirmSkip(null)}>Não</button>
                    {item.type === 'RECURRING' ? (
                      <>
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => { skipMutation.mutate({ taskId: item.taskId, date: item.date }); setConfirmSkip(null); }}>Só hoje</button>
                        <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => { deleteRoutineMutation.mutate(item.taskId); setConfirmSkip(null); }}>Rotina toda</button>
                      </>
                    ) : (
                      <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => { skipMutation.mutate({ taskId: item.taskId, date: item.date }); setConfirmSkip(null); }}>Sim</button>
                    )}
                  </div>
                ) : (
                  <>
                  <div
                    className={`task-row${item.done ? ' done' : ''}`}
                    onClick={hasSteps ? () => setExpandedChecklist((c) => ({ ...c, [checklistKey]: !c[checklistKey] })) : undefined}
                  >
                    {(item.category || item.type === 'SCHEDULED') && (
                      <div className="task-cat-bar" style={{ background: color }} />
                    )}
                    {hasSteps ? (
                      <button
                        style={{
                          minWidth: 30, height: 22, borderRadius: 'var(--r-full)', padding: '0 7px',
                          border: `2px solid ${item.done ? 'var(--brand)' : 'var(--brand-mid)'}`,
                          background: item.done ? 'var(--brand)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, cursor: 'pointer',
                        }}
                        onClick={(e) => { e.stopPropagation(); setExpandedChecklist((c) => ({ ...c, [checklistKey]: !c[checklistKey] })); }}
                        aria-label={isChecklistExpanded ? 'Recolher etapas' : 'Ver etapas'}
                      >
                        {item.done
                          ? <Check size={11} strokeWidth={3} color="white" />
                          : <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--brand)' }}>{stepsDone}/{stepsTotal}</span>
                        }
                      </button>
                    ) : (
                      <button
                        className={`task-check${item.done ? ' checked' : ''}`}
                        style={{ touchAction: 'manipulation' }}
                        onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(item.taskId, item.date, !item.done); }}
                        onClick={() => onToggle(item.taskId, item.date, !item.done)}
                        aria-label={item.done ? 'Desmarcar' : 'Marcar como feito'}
                      >
                        <Check size={11} strokeWidth={3} color="white" />
                      </button>
                    )}
                    <div className="task-info">
                      <div className={`task-name${item.done ? ' done' : ''}`}>{item.title}</div>
                      <div className="task-meta">
                        {item.startTime}{item.endTime ? ` – ${item.endTime}` : ''}
                        {item.category ? (
                          <span style={{ color: item.category.color, fontWeight: 600, marginLeft: 5 }}>· {item.category.name}</span>
                        ) : item.type === 'SCHEDULED' ? (
                          <span style={{ color: EVENT_COLOR, fontWeight: 600, marginLeft: 5 }}>· Evento</span>
                        ) : null}
                        {hasSteps && (
                          <span style={{ color: 'var(--text-muted)', fontWeight: 500, marginLeft: 5 }}>· {stepsDone}/{stepsTotal} etapas</span>
                        )}
                      </div>
                      {item.notes && <div className="task-notes">{item.notes}</div>}
                    </div>
                    {hasSteps && (
                      isChecklistExpanded
                        ? <ChevronUp size={14} strokeWidth={2} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                        : <ChevronDown size={14} strokeWidth={2} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    )}
                    <button
                      className="btn-skip"
                      onClick={(e) => { e.stopPropagation(); setConfirmSkip(item.taskId + item.date); }}
                      title="Remover deste dia"
                    >
                      <Trash2 size={13} strokeWidth={1.8} />
                    </button>
                  </div>
                  {hasSteps && isChecklistExpanded && (
                    <div style={{ padding: '2px 14px 10px 40px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {item.steps!.map((s) => (
                        <div
                          key={s.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                          onClick={() => onToggleStep(item.taskId, item.date, s.id, !s.done, item.steps!)}
                        >
                          <button
                            className={`task-check${s.done ? ' checked' : ''}`}
                            style={{ width: 17, height: 17 }}
                            aria-label={s.done ? 'Desmarcar etapa' : 'Marcar etapa como feita'}
                          >
                            <Check size={9} strokeWidth={3} color="white" />
                          </button>
                          <span style={{
                            fontSize: '0.82rem',
                            color: s.done ? 'var(--text-muted)' : 'var(--text-secondary)',
                            textDecoration: s.done ? 'line-through' : 'none',
                          }}>
                            {s.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  </>
                )}
              </div>
            );
          })}

          {/* Add to day button */}
          {!isLoading && (
            <button
              className="btn btn-ghost"
              style={{ width: '100%', gap: 8, fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}
              onClick={() => setSheetStep('choose')}
            >
              <Plus size={14} strokeWidth={2} />
              Adicionar a este dia
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

      {/* Choose what to add */}
      {sheetStep === 'choose' && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSheetStep('closed')}>
          <div className="modal">
            <div className="modal-handle" />
            <div className="modal-header">
              <span className="modal-title">Adicionar a {DAY_NAMES_FULL[new Date(selectedDate + 'T12:00:00').getDay()]}</span>
              <button className="modal-close" onClick={() => setSheetStep('closed')}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                className="task-row"
                style={{ textAlign: 'left', background: 'none', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', cursor: 'pointer' }}
                onClick={() => { setSheetStep('closed'); setShowEventModal(true); }}
              >
                <div className="task-cat-bar" style={{ background: EVENT_COLOR }} />
                <div className="task-info">
                  <div className="task-name">Novo evento</div>
                  <div className="task-meta">Compromisso único em {fmtShort(selectedDate)}</div>
                </div>
                <CalendarDays size={16} color={EVENT_COLOR} style={{ flexShrink: 0 }} />
              </button>
              <button
                className="task-row"
                style={{ textAlign: 'left', background: 'none', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', cursor: 'pointer' }}
                onClick={() => { setSheetStep('closed'); setShowTaskModal(true); }}
              >
                <div className="task-cat-bar" style={{ background: 'var(--brand)' }} />
                <div className="task-info">
                  <div className="task-name">Nova rotina</div>
                  <div className="task-meta">Tarefa recorrente, totalmente personalizável</div>
                </div>
                <Repeat size={16} color="var(--brand)" style={{ flexShrink: 0 }} />
              </button>
              <button
                className="task-row"
                style={{ textAlign: 'left', background: 'none', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', cursor: 'pointer' }}
                onClick={() => { setAddExistingTab('recurring'); setSheetStep('existing'); }}
              >
                <div className="task-cat-bar" style={{ background: 'var(--border-strong)' }} />
                <div className="task-info">
                  <div className="task-name">Usar rotina ou evento existente</div>
                  <div className="task-meta">Adicionar algo já cadastrado a este dia</div>
                </div>
                <List size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New event / new routine modals */}
      {showEventModal && (
        <EventModal
          event={null}
          initialDate={selectedDate}
          onClose={() => setShowEventModal(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['week'] })}
        />
      )}
      {showTaskModal && (
        <TaskModal
          task={null}
          categories={categories}
          initialWeekday={new Date(selectedDate + 'T12:00:00').getDay()}
          onClose={() => setShowTaskModal(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['week'] })}
        />
      )}

      {/* Add Existing Modal */}
      {sheetStep === 'existing' && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSheetStep('closed')}>
          <div className="modal">
            <div className="modal-handle" />
            <div className="modal-header">
              <button
                onClick={() => setSheetStep('choose')}
                style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, marginRight: 4 }}
                aria-label="Voltar"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="modal-title">Adicionar a {DAY_NAMES_FULL[new Date(selectedDate + 'T12:00:00').getDay()]}</span>
              <button className="modal-close" onClick={() => setSheetStep('closed')}>✕</button>
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
                  {tab === 'recurring' ? 'Rotinas' : 'Eventos'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {addExistingTab === 'recurring' && (
              recurringNotOnThisDay.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                  Todas as suas rotinas já aparecem neste dia.
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
          position: 'fixed', bottom: 'calc(68px + env(safe-area-inset-bottom) + 12px)', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--danger)', color: '#fff', borderRadius: 10, padding: '10px 18px',
          fontSize: '0.85rem', fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {toastError}
        </div>
      )}

      <AppNav />
    </>
  );
}
