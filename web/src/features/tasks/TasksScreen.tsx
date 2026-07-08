import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Bell, BellOff, CircleDot, CircleOff, CheckSquare, Check, Search, X, Star } from 'lucide-react';
import { api } from '../../lib/api';
import { BottomNav } from '../../components/BottomNav';
import { TaskRowSkeleton } from '../../components/Skeleton';
import { DAY_NAMES_FULL } from '../../lib/constants';

type Category = { id: string; name: string; color: string };

type Task = {
  id: string;
  title: string;
  type: string;
  weekdays: number[];
  startTime: string;
  endTime?: string | null;
  reminder: boolean;
  reminderMin: number;
  important?: boolean;
  countdownDays?: number | null;
  active: boolean;
  notes?: string | null;
  categoryId?: string | null;
  category?: Category | null;
  recurrenceType?: string;
  monthlyDay?: number | null;
  monthlyWeekday?: number | null;
  monthlyWeek?: number | null;
  yearlyMonth?: number | null;
};

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const PRESET_COLORS = [
  '#7255e0', '#a78bfa', '#818cf8', '#60a5fa', '#38bdf8',
  '#2dd4bf', '#34d399', '#4ade80', '#a3e635', '#facc15',
  '#fb923c', '#f87171', '#f472b6', '#e879f9', '#94a3b8',
];

// ─── CategoryModal ─────────────────────────────────────────────────
function CategoryModal({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!category;
  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? PRESET_COLORS[0]);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const upsert = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      isEdit
        ? api(`/categories/${category.id}`, { method: 'PATCH', body: JSON.stringify(data) })
        : api('/categories', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Erro'),
  });

  const del = useMutation({
    mutationFn: () => api(`/categories/${category!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
  });

  function submit() {
    if (!name.trim()) { setError('Informe o nome da categoria'); return; }
    setError('');
    upsert.mutate({ name: name.trim(), color });
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Editar categoria' : 'Nova categoria'}</span>
          <button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="field">
            <label className="label">Nome</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Trabalho, Estudo, Saúde…"
            />
          </div>

          <div className="field">
            <label className="label">Cor</label>
            <div className="color-grid">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch${color === c ? ' selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="cat-preview">
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {name.trim() || 'Nome da categoria'}
            </span>
          </div>
        </div>

        {error && <div className="error-msg" style={{ marginTop: 12 }}>{error}</div>}

        <div className="modal-actions">
          {isEdit && (
            confirmDelete ? (
              <>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', flex: 1, alignSelf: 'center' }}>Apagar mesmo?</span>
                <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Não</button>
                <button className="btn btn-danger" onClick={() => del.mutate()} disabled={del.isPending}>Sim</button>
              </>
            ) : (
              <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Apagar</button>
            )
          )}
          {!confirmDelete && <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>}
          {!confirmDelete && (
            <button className="btn btn-primary" onClick={submit} disabled={upsert.isPending}>
              {upsert.isPending ? 'Salvando…' : 'Salvar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TaskModal ─────────────────────────────────────────────────────
type RecurrenceType = 'weekly' | 'biweekly' | 'monthly_date' | 'monthly_weekday' | 'yearly';

const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal (a cada 2 semanas)',
  monthly_date: 'Mensal — dia específico do mês',
  monthly_weekday: 'Mensal — mesmo dia da semana',
  yearly: 'Anual — data específica',
};

const MONTH_OPTIONS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const WEEK_LABELS = ['1ª', '2ª', '3ª', '4ª', 'Última'];
const WEEK_VALUES = [1, 2, 3, 4, -1];

function getNthWeekday(date: Date): number {
  return Math.ceil(date.getDate() / 7);
}

type FormData = {
  title: string;
  notes: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  reminder: boolean;
  reminderMin: number;
  active: boolean;
  categoryId: string | null;
  recurrenceType: RecurrenceType;
  monthlyDay: number;
  yearlyMonth: number;
  monthlyWeekday: number;
  monthlyWeek: number;
  important: boolean;
  countdownDays: number;
};

const EMPTY_FORM: FormData = {
  title: '',
  notes: '',
  weekdays: [],
  startTime: '08:00',
  endTime: '',
  reminder: true,
  reminderMin: 60,
  active: true,
  categoryId: null,
  recurrenceType: 'weekly',
  monthlyDay: new Date().getDate(),
  yearlyMonth: new Date().getMonth() + 1,
  monthlyWeekday: new Date().getDay(),
  monthlyWeek: getNthWeekday(new Date()),
  important: false,
  countdownDays: 7,
};

function TaskModal({ task, categories, onClose }: { task: Task | null; categories: Category[]; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!task;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [form, setForm] = useState<FormData>(
    task
      ? {
          title: task.title,
          notes: task.notes ?? '',
          weekdays: task.weekdays,
          startTime: task.startTime,
          endTime: task.endTime ?? '',
          reminder: task.reminder,
          reminderMin: task.reminderMin,
          active: task.active,
          categoryId: task.categoryId ?? null,
          recurrenceType: (task.recurrenceType as RecurrenceType) ?? 'weekly',
          monthlyDay: task.monthlyDay ?? new Date().getDate(),
          yearlyMonth: task.yearlyMonth ?? (new Date().getMonth() + 1),
          monthlyWeekday: task.monthlyWeekday ?? new Date().getDay(),
          monthlyWeek: task.monthlyWeek ?? getNthWeekday(new Date()),
          important: task.important ?? false,
          countdownDays: task.countdownDays ?? 7,
        }
      : EMPTY_FORM,
  );
  const [error, setError] = useState('');

  const upsert = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      isEdit
        ? api(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify(data) })
        : api('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); onClose(); },
    onError: (e) => setError(e instanceof Error ? e.message : 'Erro'),
  });

  const del = useMutation({
    mutationFn: () => api(`/tasks/${task!.id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); onClose(); },
  });

  function submit() {
    if (!form.title.trim()) { setError('Informe o título'); return; }
    const needsDays = form.recurrenceType === 'weekly' || form.recurrenceType === 'biweekly';
    if (needsDays && form.weekdays.length === 0) { setError('Selecione pelo menos um dia'); return; }
    if (form.endTime && form.endTime <= form.startTime) { setError('O horário de fim deve ser após o de início'); return; }
    setError('');

    const now = new Date();
    const extra: Record<string, unknown> = { recurrenceType: form.recurrenceType };
    if (form.recurrenceType === 'biweekly') {
      extra.biweeklyAnchor = now.toISOString().slice(0, 10);
    } else if (form.recurrenceType === 'monthly_date') {
      extra.monthlyDay = form.monthlyDay;
      extra.important = form.important;
      extra.countdownDays = form.important ? form.countdownDays : null;
    } else if (form.recurrenceType === 'monthly_weekday') {
      extra.monthlyWeekday = form.monthlyWeekday;
      extra.monthlyWeek = form.monthlyWeek;
    } else if (form.recurrenceType === 'yearly') {
      extra.monthlyDay = form.monthlyDay;
      extra.yearlyMonth = form.yearlyMonth;
      extra.important = form.important;
      extra.countdownDays = form.important ? form.countdownDays : null;
    }

    const today = new Date();
    const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    upsert.mutate({
      title: form.title.trim(),
      notes: form.notes || undefined,
      type: 'RECURRING',
      weekdays: form.weekdays,
      ...(!isEdit ? { date: todayISO } : {}),
      startTime: form.startTime,
      endTime: form.endTime || undefined,
      reminder: form.reminder,
      reminderMin: form.reminderMin,
      active: form.active,
      categoryId: form.categoryId,
      ...extra,
    });
  }

  function toggleDay(d: number) {
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(d) ? f.weekdays.filter((x) => x !== d) : [...f.weekdays, d].sort(),
    }));
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Editar rotina' : 'Nova rotina'}</span>
          <button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <label className="label">Título</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Exercitar" />
          </div>

          <div className="field">
            <label className="label">Descrição (opcional)</label>
            <textarea className="input" rows={2} style={{ resize: 'none', minHeight: 60 }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anotações sobre esta tarefa…" />
          </div>

          <div className="field">
            <label className="label">Repetição</label>
            <select className="select" value={form.recurrenceType} onChange={(e) => setForm({ ...form, recurrenceType: e.target.value as RecurrenceType })}>
              {(Object.entries(RECURRENCE_LABELS) as [RecurrenceType, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>

            {form.recurrenceType === 'monthly_date' && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="label">Dia do mês</label>
                <select className="select" value={form.monthlyDay} onChange={(e) => setForm({ ...form, monthlyDay: Number(e.target.value) })}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>Dia {d}</option>
                  ))}
                </select>
                {form.monthlyDay > 28 && (
                  <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                    Meses com menos dias vão pular esta data
                  </div>
                )}
              </div>
            )}

            {form.recurrenceType === 'monthly_weekday' && (
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="label">Semana do mês</label>
                  <select className="select" value={form.monthlyWeek} onChange={(e) => setForm({ ...form, monthlyWeek: Number(e.target.value) })}>
                    {WEEK_VALUES.map((w, i) => (
                      <option key={w} value={w}>{WEEK_LABELS[i]}</option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="label">Dia da semana</label>
                  <select className="select" value={form.monthlyWeekday} onChange={(e) => setForm({ ...form, monthlyWeekday: Number(e.target.value) })}>
                    {DAY_NAMES_FULL.map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {form.recurrenceType === 'yearly' && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="label">Mês</label>
                    <select className="select" value={form.yearlyMonth} onChange={(e) => setForm({ ...form, yearlyMonth: Number(e.target.value) })}>
                      {MONTH_OPTIONS.map((m, i) => (
                        <option key={i + 1} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="label">Dia</label>
                    <select className="select" value={form.monthlyDay} onChange={(e) => setForm({ ...form, monthlyDay: Number(e.target.value) })}>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {form.yearlyMonth === 2 && form.monthlyDay > 28 && (
                  <div className="text-xs text-muted">
                    Fevereiro tem 28 dias (29 em ano bissexto) — dias maiores usarão o dia 28
                  </div>
                )}
              </div>
            )}
          </div>

          {(form.recurrenceType === 'weekly' || form.recurrenceType === 'biweekly') && (
          <div className="field">
            <label className="label">Dias da semana</label>
            <div className="weekday-grid">
              {DAYS.map((d, i) => (
                <button key={i} type="button" className={`weekday-btn${form.weekdays.includes(i) ? ' active' : ''}`} onClick={() => toggleDay(i)}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label className="label">Início</label>
              <input className="input" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </div>
            <div className="field">
              <label className="label">Fim (opcional)</label>
              <input className="input" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </div>
          </div>

          {categories.length > 0 && (
            <div className="field">
              <label className="label">Categoria</label>
              <div className="cat-option-grid">
                <div
                  className={`cat-option${!form.categoryId ? ' selected' : ''}`}
                  onClick={() => setForm({ ...form, categoryId: null })}
                >
                  <div className="cat-option-dot" style={{ background: 'var(--border-strong)' }} />
                  <span className="cat-option-name" style={{ color: 'var(--text-muted)' }}>Nenhuma</span>
                  {!form.categoryId && <Check size={14} color="var(--brand)" style={{ marginLeft: 'auto' }} />}
                </div>
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className={`cat-option${form.categoryId === cat.id ? ' selected' : ''}`}
                    onClick={() => setForm({ ...form, categoryId: cat.id })}
                  >
                    <div className="cat-option-dot" style={{ background: cat.color }} />
                    <span className="cat-option-name">{cat.name}</span>
                    {form.categoryId === cat.id && <Check size={14} color="var(--brand)" style={{ marginLeft: 'auto' }} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="toggle-row">
              <div>
                <div className="toggle-label">Lembrete</div>
                <div className="toggle-desc">Notificação antes do horário</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={form.reminder} onChange={(e) => setForm({ ...form, reminder: e.target.checked })} />
                <div className="toggle-track" />
              </label>
            </div>

            {form.reminder && (
              <div className="field" style={{ marginTop: 4 }}>
                <select className="select" value={form.reminderMin} onChange={(e) => setForm({ ...form, reminderMin: Number(e.target.value) })}>
                  {[
                    { value: 5,   label: '5 min antes' },
                    { value: 10,  label: '10 min antes' },
                    { value: 15,  label: '15 min antes' },
                    { value: 30,  label: '30 min antes' },
                    { value: 60,  label: '1 hora antes' },
                    { value: 120, label: '2 horas antes' },
                    { value: 180, label: '3 horas antes' },
                    { value: 360, label: '6 horas antes' },
                    { value: 720, label: '12 horas antes' },
                  ].map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {(form.recurrenceType === 'monthly_date' || form.recurrenceType === 'yearly') && (
            <div>
              <div className="toggle-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Star size={14} strokeWidth={2} color="var(--warning, #f59e0b)" fill={form.important ? 'var(--warning, #f59e0b)' : 'none'} />
                  <div>
                    <div className="toggle-label">Evento importante</div>
                    <div className="toggle-desc">Contagem regressiva diária</div>
                  </div>
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={form.important} onChange={(e) => setForm({ ...form, important: e.target.checked })} />
                  <div className="toggle-track" />
                </label>
              </div>
              {form.important && (
                <div className="field" style={{ marginTop: 4 }}>
                  <select className="select" value={form.countdownDays} onChange={(e) => setForm({ ...form, countdownDays: Number(e.target.value) })}>
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <option key={d} value={d}>{d === 1 ? 'Avisar 1 dia antes' : `Avisar ${d} dias antes`}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="toggle-row">
            <div>
              <div className="toggle-label">Ativo</div>
              <div className="toggle-desc">Aparece na semana quando ativo</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              <div className="toggle-track" />
            </label>
          </div>
        </div>

        {error && <div className="error-msg" style={{ marginTop: 12 }}>{error}</div>}

        <div className="modal-actions">
          {isEdit && (
            confirmDelete ? (
              <>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', flex: 1, alignSelf: 'center' }}>Apagar mesmo?</span>
                <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Não</button>
                <button className="btn btn-danger" onClick={() => del.mutate()} disabled={del.isPending}>Sim</button>
              </>
            ) : (
              <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Apagar</button>
            )
          )}
          {!confirmDelete && <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>}
          {!confirmDelete && (
            <button className="btn btn-primary" onClick={submit} disabled={upsert.isPending}>
              {upsert.isPending ? 'Salvando…' : 'Salvar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TasksScreen ───────────────────────────────────────────────────
export function TasksScreen() {
  const [taskModal, setTaskModal] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const [catModal, setCatModal] = useState<{ open: boolean; category: Category | null }>({ open: false, category: null });
  const [search, setSearch] = useState('');

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => api('/tasks?type=recurring'),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api('/categories'),
  });

  const q = search.trim().toLowerCase();
  const filtered = q ? tasks.filter((t) => t.title.toLowerCase().includes(q) || t.category?.name.toLowerCase().includes(q)) : tasks;

  return (
    <>
      <div className="screen-header">
        <div className="row-between">
          <div>
            <div className="screen-title">Rotinas</div>
            <div className="screen-subtitle">Tarefas que se repetem na semana</div>
          </div>
          <button
            className="btn btn-primary"
            style={{ gap: 6, paddingLeft: 14, paddingRight: 16, height: 38, fontSize: '0.85rem', flexShrink: 0 }}
            onClick={() => setTaskModal({ open: true, task: null })}
          >
            <Plus size={15} strokeWidth={2.8} />
            Novo
          </button>
        </div>
      </div>

      <div className="screen-body">
        {/* Categories section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Categorias
            </div>
            <button className="cat-chip-add" onClick={() => setCatModal({ open: true, category: null })}>
              <Plus size={11} strokeWidth={3} />
              Nova
            </button>
          </div>
          {categories.length > 0 ? (
            <div className="cat-chips-row">
              {categories.map((cat) => (
                <button key={cat.id} className="cat-chip" onClick={() => setCatModal({ open: true, category: cat })}>
                  <div className="cat-dot" style={{ background: cat.color }} />
                  {cat.name}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '4px 0' }}>
              Nenhuma categoria ainda.
            </div>
          )}
        </div>

        <div className="divider" style={{ margin: '2px 0' }} />

        {/* Search */}
        <div className="search-box">
          <Search size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <input
            className="search-input"
            placeholder="Buscar rotinas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading && [0, 1, 2, 3].map((i) => <TaskRowSkeleton key={i} />)}

        {!isLoading && filtered.length === 0 && (
          <div className="empty-state">
            <CheckSquare size={40} strokeWidth={1.2} color="var(--text-muted)" />
            <div className="empty-label">{q ? 'Nenhum resultado' : 'Sem rotinas'}</div>
            <div className="empty-hint">{q ? `Nenhum afazer com "${search}"` : 'Crie tarefas recorrentes que aparecem automaticamente na semana.'}</div>
          </div>
        )}

        {filtered.map((task) => (
          <div key={task.id} className="task-row" onClick={() => setTaskModal({ open: true, task })}>
            {task.category && (
              <div className="task-cat-bar" style={{ background: task.category.color }} />
            )}
            <div style={{ color: task.active ? 'var(--brand)' : 'var(--text-muted)', flexShrink: 0, display: 'flex' }}>
              {task.active ? <CircleDot size={16} strokeWidth={1.8} /> : <CircleOff size={16} strokeWidth={1.8} />}
            </div>
            <div className="task-info">
              <div className="task-name">{task.title}</div>
              <div className="task-meta">
                {task.weekdays.map((d) => DAYS[d]).join(' · ')} · {task.startTime}
                {task.endTime ? ` – ${task.endTime}` : ''}
                {task.category && (
                  <span style={{ color: task.category.color, fontWeight: 600, marginLeft: 5 }}>
                    · {task.category.name}
                  </span>
                )}
              </div>
            </div>
            {!task.active && <span className="pill pill-sm pill-neutral">Inativo</span>}
            {task.reminder
              ? <Bell size={14} strokeWidth={1.8} color="var(--text-muted)" />
              : <BellOff size={14} strokeWidth={1.8} color="var(--text-muted)" />
            }
          </div>
        ))}
      </div>

      {catModal.open && (
        <CategoryModal
          category={catModal.category}
          onClose={() => setCatModal({ open: false, category: null })}
        />
      )}

      {taskModal.open && (
        <TaskModal
          task={taskModal.task}
          categories={categories}
          onClose={() => setTaskModal({ open: false, task: null })}
        />
      )}

      <BottomNav />
    </>
  );
}
