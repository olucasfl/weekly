import { useState } from 'react';
import { X, GraduationCap } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { localISO } from '../../lib/date';

type ExistingSession = { startAt: string; totalCycles: number; cycleMinutes: number };

const TEMPLATES = [
  { key: 'enem1', label: 'ENEM Dia 1', hint: 'Linguagens, Humanas e Redação · 5h30', cycles: 11, time: '13:30' },
  { key: 'enem2', label: 'ENEM Dia 2', hint: 'Natureza e Matemática · 5h', cycles: 10, time: '13:30' },
] as const;

function timeHHMM(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function stepperButtonStyle(color: string) {
  return {
    width: 32, height: 32, borderRadius: 8,
    border: '1.5px solid var(--border-strong)',
    background: 'var(--bg-surface-2)', cursor: 'pointer',
    fontSize: '1.1rem', fontWeight: 700, color,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  } as const;
}

export function SetupModal({ onClose, session = null }: { onClose: () => void; session?: ExistingSession | null }) {
  const qc = useQueryClient();
  const isEditing = !!session;
  const cycleMinutes = session?.cycleMinutes ?? 30;

  const [date, setDate] = useState(() => session ? localISO(new Date(session.startAt)) : localISO());
  const [time, setTime] = useState(() => session ? timeHHMM(new Date(session.startAt)) : timeHHMM(new Date()));
  const [cycles, setCycles] = useState(session?.totalCycles ?? 4);
  const [error, setError] = useState('');

  const totalMinutes = cycles * cycleMinutes;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const durationLabel = mins === 0 ? `${hours}h` : `${hours}h${String(mins).padStart(2, '0')}`;

  const start = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time)
    ? new Date(`${date}T${time}:00`)
    : null;
  const end = start ? new Date(start.getTime() + totalMinutes * 60_000) : null;
  const fmtHM = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const saveMutation = useMutation({
    mutationFn: () => {
      const startAt = new Date(`${date}T${time}:00`).toISOString();
      return api('/study-timer/session', {
        method: isEditing ? 'PATCH' : 'POST',
        body: JSON.stringify({ startAt, totalCycles: cycles, cycleMinutes }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['study-timer-session'] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : `Erro ao ${isEditing ? 'salvar' : 'criar'} sessão`),
  });

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-header">
          <span className="modal-title">{isEditing ? 'Editar sessão' : 'Nova sessão de estudos'}</span>
          <button className="modal-close" onClick={onClose} disabled={saveMutation.isPending}><X size={18} /></button>
        </div>

        <fieldset
          disabled={saveMutation.isPending}
          style={{ display: 'flex', flexDirection: 'column', gap: 14, border: 'none', padding: 0, margin: 0 }}
        >
          <div style={{ minWidth: 0 }}>
            <label className="label" style={{ marginBottom: 8, display: 'block' }}>Modelos rápidos</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 }}>
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => { setCycles(t.cycles); setTime(t.time); }}
                  className="timer-template-btn"
                >
                  <GraduationCap size={15} strokeWidth={2} />
                  <span className="timer-template-label">{t.label}</span>
                  <span className="timer-template-hint">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
            <div className="field" style={{ minWidth: 0 }}>
              <label className="label">Data</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%', minWidth: 0 }} />
            </div>
            <div className="field" style={{ minWidth: 0 }}>
              <label className="label">Início</label>
              <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ width: '100%', minWidth: 0 }} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label className="label" style={{ marginBottom: 0 }}>Ciclos ({cycleMinutes}min cada)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setCycles((c) => Math.max(1, c - 1))} style={stepperButtonStyle('var(--text-secondary)')}>–</button>
              <span style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--brand)', minWidth: 28, textAlign: 'center' }}>{cycles}</span>
              <button onClick={() => setCycles((c) => Math.min(48, c + 1))} style={stepperButtonStyle('var(--brand)')}>+</button>
            </div>
          </div>

          {start && end && (
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                background: 'var(--bg-surface-2)', borderRadius: 'var(--r-md)', padding: '12px 14px',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Início</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmtHM(start)}</div>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>→</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Término</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtHM(end)}
                </div>
              </div>
            </div>
          )}

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            {cycles} ciclo{cycles !== 1 ? 's' : ''} · {durationLabel}
          </div>
        </fieldset>

        {error && <div className="error-msg" style={{ marginTop: 12 }}>{error}</div>}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={saveMutation.isPending}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Salvando…' : isEditing ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}
