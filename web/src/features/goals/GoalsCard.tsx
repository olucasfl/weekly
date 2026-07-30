import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Check, Pencil,
  Target, Repeat, Calendar, Trophy, Sparkles, ChevronDown, ChevronUp,
} from 'lucide-react';
import { api } from '../../lib/api';

type Category = { id: string; name: string; color: string };

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
export function GoalCard({ goal, weekStart, onEdit }: { goal: Goal; weekStart: string; onEdit: () => void }) {
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
            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              <button
                onClick={onEdit}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--text-muted)', opacity: 0.5, lineHeight: 1 }}
                aria-label="Editar meta"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => setConfirmDel(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--text-muted)', opacity: 0.4, lineHeight: 1 }}
                aria-label="Apagar meta"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        {goal.category && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: goal.category.color, flexShrink: 0 }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{goal.category.name}</span>
          </div>
        )}

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

// ─── GoalFormModal (cria ou edita) ─────────────────────────────────────────
export function GoalFormModal({
  goal,
  weekStart,
  onClose,
  onSaved,
}: {
  goal: Goal | null;
  weekStart: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!goal;
  const [title, setTitle] = useState(goal?.title ?? '');
  const [target, setTarget] = useState(goal?.target ?? 1);
  const [isRecurring, setIsRecurring] = useState(goal?.recurring ?? true);
  const [categoryId, setCategoryId] = useState<string | null>(goal?.categoryId ?? null);
  const [error, setError] = useState('');

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api('/categories'),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      isEdit
        ? api(`/goals/${goal!.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ title: title.trim(), target, categoryId }),
          })
        : api('/goals', {
            method: 'POST',
            body: JSON.stringify({
              title: title.trim(),
              target,
              weekStart: isRecurring ? null : weekStart,
              categoryId,
            }),
          }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof Error ? e.message : 'Erro ao salvar'),
  });

  function submit() {
    if (!title.trim()) { setError('Informe um título'); return; }
    saveMutation.mutate();
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
        <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 18 }}>{isEdit ? 'Editar meta' : 'Nova meta'}</div>

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

          {/* Type — flat segmented control (só na criação; não é editável depois) */}
          {!isEdit ? (
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
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {goal!.recurring ? <Repeat size={13} /> : <Calendar size={13} />}
              {goal!.recurring ? 'Meta recorrente (toda semana)' : `Meta desta semana`}
            </div>
          )}

          {/* Category — liga a meta a uma categoria de rotina; ao completar uma tarefa
              dessa categoria, o progresso desta meta avança sozinho. */}
          {categories.length > 0 && (
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Categoria (opcional)
              </label>
              <div className="cat-option-grid">
                <div
                  className={`cat-option${!categoryId ? ' selected' : ''}`}
                  onClick={() => setCategoryId(null)}
                >
                  <div className="cat-option-dot" style={{ background: 'var(--border-strong)' }} />
                  <span className="cat-option-name" style={{ color: 'var(--text-muted)' }}>Nenhuma</span>
                  {!categoryId && <Check size={14} color="var(--brand)" style={{ marginLeft: 'auto' }} />}
                </div>
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className={`cat-option${categoryId === cat.id ? ' selected' : ''}`}
                    onClick={() => setCategoryId(cat.id)}
                  >
                    <div className="cat-option-dot" style={{ background: cat.color }} />
                    <span className="cat-option-name">{cat.name}</span>
                    {categoryId === cat.id && <Check size={14} color="var(--brand)" style={{ marginLeft: 'auto' }} />}
                  </div>
                ))}
              </div>
              {categoryId && (
                <div className="text-xs text-muted" style={{ marginTop: 6 }}>
                  Completar uma rotina dessa categoria avança esta meta automaticamente.
                </div>
              )}
            </div>
          )}
        </div>

        {error && <div style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: 6 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            style={{ flex: 2 }}
            onClick={submit}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar meta'}
          </button>
        </div>
        </div>
      </div>
    </>
  );
}

// ─── WeekGoalsCard ──────────────────────────────────────────────────────
// Metas embutidas direto na aba Semana — sem tela própria: resumo compacto
// que expande pra marcar progresso e criar/editar sem sair da tela mais usada.
export function WeekGoalsCard({ weekStartISO }: { weekStartISO: string }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [formModal, setFormModal] = useState<{ open: boolean; goal: Goal | null }>({ open: false, goal: null });

  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: ['goals', weekStartISO],
    queryFn: () => api(`/goals?weekStart=${weekStartISO}`),
  });

  const total = goals.length;
  const completed = goals.filter((g) => g.done).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const allDone = total > 0 && completed === total;
  const sortedGoals = [...goals].sort((a, b) => Number(b.recurring) - Number(a.recurring));

  function closeForm() {
    setFormModal({ open: false, goal: null });
  }
  function onSaved() {
    closeForm();
    qc.invalidateQueries({ queryKey: ['goals', weekStartISO] });
  }

  if (isLoading) return null;

  return (
    <>
      {total === 0 ? (
        <button
          className="btn btn-ghost"
          style={{ width: '100%', gap: 8, fontSize: '0.82rem', color: 'var(--text-muted)' }}
          onClick={() => setFormModal({ open: true, goal: null })}
        >
          <Target size={15} strokeWidth={1.8} color="var(--brand)" />
          Criar uma meta para esta semana
        </button>
      ) : (
        <div
          style={{
            background: allDone ? 'var(--success-bg)' : 'var(--bg-surface)',
            border: `1px solid ${allDone ? 'rgba(5,150,105,0.2)' : 'var(--border)'}`,
            borderRadius: 'var(--r-md)',
            overflow: 'hidden',
            transition: 'background 0.25s, border-color 0.25s',
          }}
        >
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            {allDone ? <Trophy size={16} color="var(--success)" style={{ flexShrink: 0 }} /> : <Target size={16} color="var(--brand)" style={{ flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: '0.85rem', color: allDone ? 'var(--success)' : 'var(--text-primary)' }}>
                  {allDone && <Sparkles size={13} />}
                  {allDone ? 'Metas completas!' : 'Metas da semana'}
                </span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: allDone ? 'var(--success)' : 'var(--text-muted)', flexShrink: 0 }}>{completed}/{total}</span>
              </div>
              <div style={{ height: 5, borderRadius: 99, background: 'var(--bg-surface-2)', overflow: 'hidden', marginTop: 6 }}>
                <div style={{ height: '100%', width: `${percent}%`, background: allDone ? 'var(--success)' : 'var(--brand-grad)', borderRadius: 99, transition: 'width 0.3s' }} />
              </div>
            </div>
            {expanded ? <ChevronUp size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} /> : <ChevronDown size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
          </button>

          {expanded && (
            <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sortedGoals.map((g) => (
                <GoalCard key={g.id} goal={g} weekStart={weekStartISO} onEdit={() => setFormModal({ open: true, goal: g })} />
              ))}
              <button
                className="btn btn-ghost"
                style={{ gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}
                onClick={() => setFormModal({ open: true, goal: null })}
              >
                <Plus size={14} strokeWidth={2} />
                Nova meta
              </button>
            </div>
          )}
        </div>
      )}

      {formModal.open && (
        <GoalFormModal
          goal={formModal.goal}
          weekStart={weekStartISO}
          onClose={closeForm}
          onSaved={onSaved}
        />
      )}
    </>
  );
}
