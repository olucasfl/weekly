import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Bell, CalendarDays } from 'lucide-react';
import { api } from '../../lib/api';
import { BottomNav } from '../../components/BottomNav';

type Event = {
  id: string;
  title: string;
  date?: string | null;
  startTime: string;
  endTime?: string | null;
  reminder: boolean;
  reminderMin: number;
  active: boolean;
};

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const EVENT_COLOR = '#f43f5e';

function formatDate(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type FormData = { title: string; date: string; startTime: string; endTime: string; reminder: boolean; reminderMin: number };
const EMPTY: FormData = { title: '', date: todayISO(), startTime: '09:00', endTime: '', reminder: true, reminderMin: 60 };

function EventModal({ event, onClose }: { event: Event | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!event;
  const [form, setForm] = useState<FormData>(
    event ? { title: event.title, date: event.date ?? todayISO(), startTime: event.startTime, endTime: event.endTime ?? '', reminder: event.reminder, reminderMin: event.reminderMin } : EMPTY,
  );
  const [error, setError] = useState('');

  const upsert = useMutation({
    mutationFn: (d: Record<string, unknown>) =>
      isEdit ? api(`/tasks/${event.id}`, { method: 'PATCH', body: JSON.stringify(d) }) : api('/tasks', { method: 'POST', body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); onClose(); },
    onError: (e) => setError(e instanceof Error ? e.message : 'Erro'),
  });

  const del = useMutation({
    mutationFn: () => api(`/tasks/${event!.id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); onClose(); },
  });

  function submit() {
    if (!form.title.trim()) { setError('Informe o título'); return; }
    if (!form.date) { setError('Informe a data'); return; }
    setError('');
    upsert.mutate({ title: form.title.trim(), type: 'SCHEDULED', weekdays: [], date: form.date, startTime: form.startTime, endTime: form.endTime || undefined, reminder: form.reminder, reminderMin: form.reminderMin, active: true });
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-title">{isEdit ? 'Editar evento' : 'Novo evento'}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label className="label">Título</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Reunião com cliente" autoFocus />
          </div>
          <div className="field">
            <label className="label">Data</label>
            <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
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
          <div>
            <div className="toggle-row">
              <div>
                <div className="toggle-label">Lembrete</div>
                <div className="toggle-desc">Notificação antes do evento</div>
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
        </div>

        {error && <div className="error-msg" style={{ marginTop: 12 }}>{error}</div>}

        <div className="modal-actions">
          {isEdit && <button className="btn btn-danger" onClick={() => del.mutate()} disabled={del.isPending}>Apagar</button>}
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={upsert.isPending}>
            {upsert.isPending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EventsScreen() {
  const [modal, setModal] = useState<{ open: boolean; event: Event | null }>({ open: false, event: null });

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: () => api('/tasks?type=scheduled'),
  });

  const today = todayISO();
  const todayEvents = events.filter((e) => e.date === today).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const upcoming = events.filter((e) => (e.date ?? '') > today).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.startTime.localeCompare(b.startTime));
  const past = events.filter((e) => (e.date ?? '') < today).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

  return (
    <>
      <div className="screen-header">
        <div className="screen-title">Eventos</div>
        <div className="screen-subtitle">Compromissos agendados por data</div>
      </div>

      <div className="screen-body">
        {isLoading && <div className="spinner" />}

        {!isLoading && events.length === 0 && (
          <div className="empty-state">
            <CalendarDays size={40} strokeWidth={1.2} color="var(--text-muted)" />
            <div className="empty-label">Sem eventos</div>
            <div className="empty-hint">Agende compromissos que aparecem na semana quando a data chegar.</div>
          </div>
        )}

        {todayEvents.length > 0 && (
          <>
            <div className="text-xs font-semibold" style={{ paddingLeft: 2, textTransform: 'uppercase', letterSpacing: '0.06em', color: EVENT_COLOR }}>Hoje</div>
            {todayEvents.map((ev) => (
              <div key={ev.id} className="task-row" onClick={() => setModal({ open: true, event: ev })} style={{ borderLeft: `3px solid ${EVENT_COLOR}` }}>
                <div className="task-cat-bar" style={{ background: EVENT_COLOR }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40, gap: 1 }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: EVENT_COLOR, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {MONTH_NAMES[new Date().getMonth()]}
                  </span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: EVENT_COLOR, lineHeight: 1 }}>
                    {new Date().getDate()}
                  </span>
                </div>
                <div className="task-info">
                  <div className="task-name">{ev.title}</div>
                  <div className="task-meta">
                    {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}
                    <span style={{ color: EVENT_COLOR, fontWeight: 600, marginLeft: 5 }}>· Hoje</span>
                  </div>
                </div>
                {ev.reminder && <Bell size={14} strokeWidth={1.8} color={EVENT_COLOR} />}
              </div>
            ))}
          </>
        )}

        {upcoming.length > 0 && (
          <>
            {todayEvents.length > 0 && <div className="divider" />}
            <div className="text-xs text-muted font-semibold" style={{ paddingLeft: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Próximos</div>
            {upcoming.map((ev) => (
              <div key={ev.id} className="task-row" onClick={() => setModal({ open: true, event: ev })}>
                <div className="task-cat-bar" style={{ background: EVENT_COLOR }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40, gap: 1 }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: EVENT_COLOR, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {ev.date ? MONTH_NAMES[new Date(ev.date + 'T12:00:00').getMonth()] : ''}
                  </span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {ev.date ? new Date(ev.date + 'T12:00:00').getDate() : '?'}
                  </span>
                </div>
                <div className="task-info">
                  <div className="task-name">{ev.title}</div>
                  <div className="task-meta">
                    {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}
                    <span style={{ color: EVENT_COLOR, fontWeight: 600, marginLeft: 5 }}>· Evento</span>
                  </div>
                </div>
                {ev.reminder && <Bell size={14} strokeWidth={1.8} color="var(--text-muted)" />}
              </div>
            ))}
          </>
        )}

        {past.length > 0 && (
          <>
            <div className="divider" />
            <div className="text-xs text-muted font-semibold" style={{ paddingLeft: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Passados</div>
            {past.map((ev) => (
              <div key={ev.id} className="task-row done" onClick={() => setModal({ open: true, event: ev })}>
                <div className="task-cat-bar" style={{ background: EVENT_COLOR, opacity: 0.4 }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40, gap: 1 }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {ev.date ? MONTH_NAMES[new Date(ev.date + 'T12:00:00').getMonth()] : ''}
                  </span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-muted)', lineHeight: 1 }}>
                    {ev.date ? new Date(ev.date + 'T12:00:00').getDate() : '?'}
                  </span>
                </div>
                <div className="task-info">
                  <div className="task-name done">{ev.title}</div>
                  <div className="task-meta">
                    {ev.date ? formatDate(ev.date) : ''} · {ev.startTime}
                    <span style={{ color: EVENT_COLOR, fontWeight: 600, marginLeft: 5, opacity: 0.6 }}>· Evento</span>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <button className="fab" onClick={() => setModal({ open: true, event: null })} aria-label="Novo evento">
        <Plus size={22} strokeWidth={2.5} />
      </button>

      {modal.open && <EventModal event={modal.event} onClose={() => setModal({ open: false, event: null })} />}
      <BottomNav />
    </>
  );
}
