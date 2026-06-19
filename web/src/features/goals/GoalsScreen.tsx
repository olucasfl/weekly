import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Check,
  ArrowLeft, Target, Repeat, Calendar, Trophy, Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { localISO, weekStartOf, addDays } from '../../lib/date';
import { BottomNav } from '../../components/BottomNav';
import { MONTH_NAMES_LC } from '../../lib/constants';

type Goal = {
  id: string;
  title: string;
  target: number;
  weekStart: string | null;
  recurring: boolean;
  categoryId: string | null;
  category: { id: string; name: string; color: string } | null;
  count: number;
  done: boolean;
};

function isoToDate(iso: string): Date {
  return new Date(iso + 'T12:00:00');
}

function fmtWeekRange(weekStartISO: string): string {
  const start = isoToDate(weekStartISO);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const sD = start.getDate();
  const sM = MONTH_NAMES_LC[start.getMonth()];
  const eD = end.getDate();
  const eM = MONTH_NAMES_LC[end.getMonth()];
  return sM === eM ? `${sD}–${eD} ${sM}` : `${sD} ${sM} – ${eD} ${eM}`;
}

function offsetISO(iso: string, days: number): string {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + days);
  return localISO(d);
}

// ─── ProgressDots ───────────────────────────────────────────────────────
function ProgressDots({
  count, target, onSetCount,
}: {
  count: number;
  target: number;
  onSetCount: (n: number) => void;
}) {
  if (target === 1) {
    return (
      <button
        onClick={() => onSetCount(count === 1 ? 0 : 1)}
        style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          border: count === 1 ? 'none' : '2.5px solid var(--border-strong)',
          background: count === 1 ? 'var(--brand-grad)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: count === 1 ? 'var(--shadow-brand)' : 'none',
          padding: 0,
        }}
      >
        {count === 1 && <Check size={14} strokeWidth={3} color="white" />}
      </button>
    );
  }

  if (target <= 7) {
    return (
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
        {Array.from({ length: target }, (_, i) => {
          const idx = i + 1;
          const filled = idx <= count;
          return (
            <button
              key={i}
              onClick={() => onSetCount(filled && idx === count ? count - 1 : idx)}
              style={{
                width: 22, height: 22, borderRadius: '50%', padding: 0,
                border: filled ? 'none' : '2px solid var(--border-strong)',
                background: filled ? 'var(--brand-grad)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.18s',
                boxShadow: filled ? '0 2px 6px rgba(114,85,224,0.35)' : 'none',
              }}
            />
          );
        })}
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 2 }}>
          {count}/{target}
        </span>
      </div>
    );
  }

  const pct = target > 0 ? Math.round((count / target) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 99, background: 'var(--bg-surface-2)', overflow: 'hidden', minWidth: 50 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--brand-grad)', borderRadius: 99, transition: 'width 0.3s' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <button
          disabled={count === 0}
          onClick={() => onSetCount(count - 1)}
          style={{
            width: 26, height: 26, borderRadius: 6,
            border: '1.5px solid var(--border-strong)',
            background: 'var(--bg-surface-2)', cursor: count === 0 ? 'default' : 'pointer',
            fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: count === 0 ? 0.4 : 1,
          }}
        >–</button>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, minWidth: 34, textAlign: 'center', color: 'var(--text-primary)' }}>
          {count}/{target}
        </span>
        <button
          disabled={count === target}
          onClick={() => onSetCount(count + 1)}
          style={{
            width: 26, height: 26, borderRadius: 6,
            border: '1.5px solid var(--border-strong)',
            background: 'var(--bg-surface-2)', cursor: count === target ? 'default' : 'pointer',
            fontSize: '1rem', fontWeight: 700, color: 'var(--brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: count === target ? 0.4 : 1,
          }}
        >+</button>
      </div>
    </div>
  );
}

// ─── GoalCard ────────────────────────────────────────────────────────────
function GoalCard({ goal, weekStart }: { goal: Goal; weekStart: string }) {
  const qc = useQueryClient();
  const [confirmDel, setConfirmDel] = useState(false);

  // Local count para feedback instantâneo; sincroniza quando servidor responde
  const [localCount, setLocalCount] = useState(goal.count);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setLocalCount(goal.count); }, [goal.count]);

  const progressMutation = useMutation({
    mutationFn: (count: number) =>
      api(`/goals/${goal.id}/progress`, { method: 'PUT', body: JSON.stringify({ weekStart, count }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals', weekStart] }),
    onError: () => {
      // Reverte para o último valor do servidor em caso de erro
      setLocalCount(goal.count);
      qc.invalidateQueries({ queryKey: ['goals', weekStart] });
    },
  });

  function handleSetCount(n: number) {
    setLocalCount(n); // feedback instantâneo na UI
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Aguarda 350ms sem novos cliques para disparar a requisição
    debounceRef.current = setTimeout(() => progressMutation.mutate(n), 350);
  }

  const deleteMutation = useMutation({
    mutationFn: () => api(`/goals/${goal.id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals', weekStart] }),
  });

  const color = goal.category?.color ?? 'var(--brand)';
  const localDone = localCount >= goal.target;

  return (
    <div
      style={{
        background: localDone ? 'var(--success-bg)' : 'var(--bg-surface)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--shadow-xs)',
        overflow: 'hidden',
        display: 'flex',
        border: localDone ? '1px solid rgba(5,150,105,0.2)' : '1px solid var(--border)',
        transition: 'background 0.25s, border-color 0.25s',
        opacity: deleteMutation.isPending ? 0.5 : 1,
      }}
    >
      <div style={{ width: 5, background: localDone ? 'var(--success)' : color, flexShrink: 0, transition: 'background 0.25s' }} />

      <div style={{ flex: 1, padding: '12px 12px 12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
            {localDone && <Trophy size={13} color="var(--success)" style={{ flexShrink: 0 }} />}
            <span
              style={{
                fontWeight: 600,
                fontSize: '0.9rem',
                color: localDone ? 'var(--success)' : 'var(--text-primary)',
                textDecoration: localDone ? 'line-through' : 'none',
                opacity: localDone ? 0.75 : 1,
                lineHeight: 1.3,
                transition: 'color 0.2s',
              }}
            >
              {goal.title}
            </span>
          </div>

          {confirmDel ? (
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button
                onClick={() => setConfirmDel(false)}
                style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                Não
              </button>
              <button
                onClick={() => { deleteMutation.mutate(); setConfirmDel(false); }}
                style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: 6, border: 'none', background: 'var(--danger)', color: 'white', cursor: 'pointer' }}
              >
                Sim
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDel(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--text-muted)', opacity: 0.4, flexShrink: 0, lineHeight: 1 }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        <div style={{ marginTop: 10 }}>
          <ProgressDots
            count={localCount}
            target={goal.target}
            onSetCount={handleSetCount}
          />
        </div>
      </div>
    </div>
  );
}

// ─── AddGoalModal ─────────────────────────────────────────────────────────
function AddGoalModal({
  weekStart,
  onClose,
  onCreated,
}: {
  weekStart: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState(1);
  const [isRecurring, setIsRecurring] = useState(true);
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      api('/goals', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          target,
          weekStart: isRecurring ? null : weekStart,
        }),
      }),
    onSuccess: onCreated,
    onError: (e) => setError(e instanceof Error ? e.message : 'Erro ao criar'),
  });

  function submit() {
    if (!title.trim()) { setError('Informe um título'); return; }
    createMutation.mutate();
  }

  return (
    <>
      {/* Overlay sem blur */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(12,8,26,0.55)',
          animation: 'fadeIn 0.18s ease',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px 20px',
          paddingBottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 20px)',
        }}
      >
        {/* Modal centralizado — stopPropagation evita fechar ao clicar dentro */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 400,
            background: 'var(--bg-surface)',
            borderRadius: 'var(--r-xl)',
            padding: '24px 22px',
            boxShadow: '0 24px 64px rgba(40,20,100,0.22)',
            animation: 'scaleIn 0.2s cubic-bezier(0.22,1,0.36,1)',
            maxHeight: 'calc(100dvh - var(--nav-h) - 60px)',
            overflowY: 'auto',
          }}
        >
        <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 18 }}>Nova Meta</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Title */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Título
            </label>
            <input
              className="input"
              placeholder="Ex: Ler 20 minutos"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(''); }}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>

          {/* Target picker — inline row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Quantas vezes
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => setTarget((t) => Math.max(1, t - 1))}
                style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border-strong)', background: 'var(--bg-surface-2)', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >–</button>
              <span style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--brand)', minWidth: 24, textAlign: 'center', lineHeight: 1 }}>{target}</span>
              <button
                onClick={() => setTarget((t) => Math.min(30, t + 1))}
                style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border-strong)', background: 'var(--bg-surface-2)', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >+</button>
            </div>
          </div>

          {/* Dot preview */}
          {target > 1 && (
            <div style={{ display: 'flex', gap: 5, paddingLeft: 2 }}>
              {Array.from({ length: Math.min(target, 7) }, (_, i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--brand)', opacity: 0.5 + (i / Math.max(target - 1, 1)) * 0.5 }} />
              ))}
              {target > 7 && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 2 }}>+{target - 7}</span>}
            </div>
          )}

          {/* Type — flat segmented control */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tipo
            </label>
            <div style={{ display: 'flex', background: 'var(--bg-surface-2)', borderRadius: 'var(--r-md)', padding: 3, gap: 3 }}>
              {([
                { val: true,  label: 'Recorrente',  Icon: Repeat   },
                { val: false, label: 'Esta semana', Icon: Calendar },
              ] as const).map(({ val, label, Icon }) => (
                <button
                  key={String(val)}
                  onClick={() => setIsRecurring(val)}
                  style={{
                    flex: 1, padding: '8px 6px', borderRadius: 'calc(var(--r-md) - 3px)', cursor: 'pointer', border: 'none',
                    background: isRecurring === val ? 'var(--bg-surface)' : 'transparent',
                    boxShadow: isRecurring === val ? 'var(--shadow-xs)' : 'none',
                    transition: 'all 0.18s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}
                >
                  <Icon size={13} color={isRecurring === val ? 'var(--brand)' : 'var(--text-muted)'} />
                  <span style={{ fontSize: '0.82rem', fontWeight: isRecurring === val ? 700 : 500, color: isRecurring === val ? 'var(--brand)' : 'var(--text-muted)' }}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <div style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: 6 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            style={{ flex: 2 }}
            onClick={submit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Criando…' : 'Criar meta'}
          </button>
        </div>
        </div>
      </div>
    </>
  );
}

// ─── GoalsScreen ──────────────────────────────────────────────────────────
export function GoalsScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const todayISO = localISO(weekStartOf());
  const [weekStartISO, setWeekStartISO] = useState<string>(() => todayISO);
  const [showModal, setShowModal] = useState(false);

  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: ['goals', weekStartISO],
    queryFn: () => api(`/goals?weekStart=${weekStartISO}`),
  });

  const recurring = goals.filter((g) => g.recurring);
  const thisWeek = goals.filter((g) => !g.recurring);
  const total = goals.length;
  const completed = goals.filter((g) => g.done).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isCurrentWeek = weekStartISO === todayISO;

  function prevWeek() { setWeekStartISO(offsetISO(weekStartISO, -7)); }
  function nextWeek() { setWeekStartISO(offsetISO(weekStartISO, 7)); }

  return (
    <>
      {/* Header */}
      <div className="screen-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px 2px', color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center',
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Metas
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button className="btn btn-icon" onClick={prevWeek} style={{ width: 30, height: 30 }}>
              <ChevronLeft size={15} />
            </button>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {fmtWeekRange(weekStartISO)}
            </span>
            <button className="btn btn-icon" onClick={nextWeek} style={{ width: 30, height: 30 }}>
              <ChevronRight size={15} />
            </button>
            {!isCurrentWeek && (
              <button
                className="pill pill-sm"
                style={{ cursor: 'pointer', border: 'none', marginLeft: 2 }}
                onClick={() => setWeekStartISO(todayISO)}
              >
                Hoje
              </button>
            )}
          </div>

          <button
            className="btn btn-primary btn-icon"
            onClick={() => setShowModal(true)}
            style={{ borderRadius: '50%', width: 36, height: 36, padding: 0, flexShrink: 0 }}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="screen-body">

        {/* Summary card */}
        {!isLoading && total > 0 && (
          <div
            style={{
              background: 'var(--brand-grad)',
              borderRadius: 'var(--r-lg)',
              padding: '18px 20px',
              color: 'white',
              marginBottom: 22,
              boxShadow: 'var(--shadow-brand)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', opacity: 0.95 }}>
                  {completed === total && total > 0
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Sparkles size={14} />Semana completa!</span>
                    : `${completed} de ${total} concluída${total !== 1 ? 's' : ''}`}
                </div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: 2 }}>metas desta semana</div>
              </div>
              <div
                style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid rgba(255,255,255,0.35)',
                }}
              >
                <span style={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1 }}>{percent}%</span>
              </div>
            </div>
            <div style={{ height: 7, borderRadius: 99, background: 'rgba(255,255,255,0.22)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${percent}%`,
                  background: 'white',
                  borderRadius: 99,
                  transition: 'width 0.5s ease',
                  boxShadow: '0 0 10px rgba(255,255,255,0.6)',
                }}
              />
            </div>
          </div>
        )}

        {/* Skeleton */}
        {isLoading && (
          <>
            <div className="skeleton" style={{ height: 102, borderRadius: 'var(--r-lg)', marginBottom: 22 }} />
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ height: 74, borderRadius: 'var(--r-md)', marginBottom: 8 }} />
            ))}
          </>
        )}

        {/* Empty state */}
        {!isLoading && goals.length === 0 && (
          <div className="empty-state">
            <Target size={44} strokeWidth={1.2} color="var(--brand)" />
            <div className="empty-label">Sem metas</div>
            <div className="empty-hint">Defina o que quer conquistar esta semana e acompanhe seu progresso.</div>
            <button
              className="btn btn-primary"
              style={{ marginTop: 16, gap: 6 }}
              onClick={() => setShowModal(true)}
            >
              <Plus size={15} />
              Criar primeira meta
            </button>
          </div>
        )}

        {/* Recorrentes */}
        {recurring.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <Repeat size={13} color="var(--brand)" />
              <span style={{ fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Recorrentes
              </span>
              <span className="pill pill-sm">
                {recurring.filter((g) => g.done).length}/{recurring.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recurring.map((g) => (
                <GoalCard key={g.id} goal={g} weekStart={weekStartISO} />
              ))}
            </div>
          </div>
        )}

        {/* Esta semana */}
        {thisWeek.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <Calendar size={13} color="var(--brand)" />
              <span style={{ fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Desta semana
              </span>
              <span className="pill pill-sm">
                {thisWeek.filter((g) => g.done).length}/{thisWeek.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {thisWeek.map((g) => (
                <GoalCard key={g.id} goal={g} weekStart={weekStartISO} />
              ))}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <AddGoalModal
          weekStart={weekStartISO}
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            qc.invalidateQueries({ queryKey: ['goals', weekStartISO] });
          }}
        />
      )}

      <BottomNav />
    </>
  );
}
