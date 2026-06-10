import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Bell, BellOff, CircleDot, CircleOff, CheckSquare, Check, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { BottomNav } from '../../components/BottomNav';
import { TaskRowSkeleton } from '../../components/Skeleton';

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
  active: boolean;
  categoryId?: string | null;
  category?: Category | null;
  recurrenceType?: string;
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
        <div className="modal-title">{isEdit ? 'Editar categoria' : 'Nova categoria'}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="field">
            <label className="label">Nome</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Trabalho, Estudo, Saúde…"
              autoFocus
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
            <button className="btn btn-danger" onClick={() => del.mutate()} disabled={del.isPending}>
              Apagar
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={upsert.isPending}>
            {upsert.isPending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TaskModal ─────────────────────────────────────────────────────
type RecurrenceType = 'weekly' | 'biweekly' | 'monthly_date' | 'monthly_weekday';

const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal (a cada 2 semanas)',
  monthly_date: 'Mensal — mesmo dia do mês',
  monthly_weekday: 'Mensal — mesmo dia da semana',
};

const DAY_NAMES_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const WEEK_LABELS = ['1ª', '2ª', '3ª', '4ª', 'Última'];
const WEEK_VALUES = [1, 2, 3, 4, -1];

function getNthWeekday(date: Date): number {
  return Math.ceil(date.getDate() / 7);
}

type FormData = {
  title: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  reminder: boolean;
  reminderMin: number;
  active: boolean;
  categoryId: string | null;
  recurrenceType: RecurrenceType;
};

const EMPTY_FORM: FormData = {
  title: '',
  weekdays: [],
  startTime: '08:00',
  endTime: '',
  reminder: true,
  reminderMin: 60,
  active: true,
  categoryId: null,
  recurrenceType: 'weekly',
};

function TaskModal({ task, categories, onClose }: { task: Task | null; categories: Category[]; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!task;

  const [form, setForm] = useState<FormData>(
    task
      ? {
          title: task.title,
          weekdays: task.weekdays,
          startTime: task.startTime,
          endTime: task.endTime ?? '',
          reminder: task.reminder,
          reminderMin: task.reminderMin,
          active: task.active,
          categoryId: task.categoryId ?? null,
          recurrenceType: (task.recurrenceType as RecurrenceType) ?? 'weekly',
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
    setError('');

    const now = new Date();
    const extra: Record<string, unknown> = { recurrenceType: form.recurrenceType };
    if (form.recurrenceType === 'biweekly') {
      extra.biweeklyAnchor = now.toISOString().slice(0, 10);
    } else if (form.recurrenceType === 'monthly_date') {
      extra.monthlyDay = now.getDate();
    } else if (form.recurrenceType === 'monthly_weekday') {
      extra.monthlyWeekday = now.getDay();
      extra.monthlyWeek = getNthWeekday(now);
    }

    upsert.mutate({
      title: form.title.trim(),
      type: 'RECURRING',
      weekdays: form.weekdays,
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
        <div className="modal-title">{isEdit ? 'Editar afazer' : 'Novo afazer'}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <label className="label">Título</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Exercitar" autoFocus />
          </div>

          <div className="field">
            <label className="label">Repetição</label>
            <select className="select" value={form.recurrenceType} onChange={(e) => setForm({ ...form, recurrenceType: e.target.value as RecurrenceType })}>
              {(Object.entries(RECURRENCE_LABELS) as [RecurrenceType, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            {(form.recurrenceType === 'monthly_date' || form.recurrenceType === 'monthly_weekday') && (
              <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                {form.recurrenceType === 'monthly_date'
                  ? `Toda o dia ${new Date().getDate()} de cada mês`
                  : `${WEEK_LABELS[Math.min(getNthWeekday(new Date()) - 1, 4)]} ${DAY_NAMES_FULL[new Date().getDay()]} de cada mês`}
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
              <div className="field" style={{ marginTop: 8 }}>
                <label className="label">Antecedência</label>
                <select className="select" value={form.reminderMin} onChange={(e) => setForm({ ...form, reminderMin: Number(e.target.value) })}>
                  {[5, 10, 15, 30, 60, 120].map((m) => (
                    <option key={m} value={m}>{m} min antes</option>
                  ))}
                </select>
              </div>
            )}
          </div>

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
            <button className="btn btn-danger" onClick={() => del.mutate()} disabled={del.isPending}>
              Apagar
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={upsert.isPending}>
            {upsert.isPending ? 'Salvando…' : 'Salvar'}
          </button>
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
            <div className="screen-title">Afazeres</div>
            <div className="screen-subtitle">Tarefas recorrentes da sua rotina</div>
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
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Categorias
          </div>
          <div className="cat-chips-row">
            {categories.map((cat) => (
              <button key={cat.id} className="cat-chip" onClick={() => setCatModal({ open: true, category: cat })}>
                <div className="cat-dot" style={{ background: cat.color }} />
                {cat.name}
              </button>
            ))}
            <button className="cat-chip-add" onClick={() => setCatModal({ open: true, category: null })}>
              <Plus size={11} strokeWidth={3} />
              Nova
            </button>
          </div>
        </div>

        <div className="divider" style={{ margin: '2px 0' }} />

        {/* Search */}
        <div className="search-box">
          <Search size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <input
            className="search-input"
            placeholder="Buscar afazeres…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading && [0, 1, 2, 3].map((i) => <TaskRowSkeleton key={i} />)}

        {!isLoading && filtered.length === 0 && (
          <div className="empty-state">
            <CheckSquare size={40} strokeWidth={1.2} color="var(--text-muted)" />
            <div className="empty-label">{q ? 'Nenhum resultado' : 'Sem afazeres'}</div>
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
