import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Timer, X, Plus, Sparkles, Pencil, Pause, Play, History, Maximize2, Minimize2 } from 'lucide-react';
import { api } from '../../lib/api';
import { BottomNav } from '../../components/BottomNav';
import { isPWA } from '../../components/SplashScreen';
import { useStudyTimerTick } from './useStudyTimerTick';
import { useWakeLock } from './useWakeLock';
import { CheckpointList } from './CheckpointList';
import { SetupModal } from './SetupModal';

type RawSession = {
  id: string;
  totalCycles: number;
  cycleMinutes: number;
  startAt: string;
  pausedAt: string | null;
  totalPausedMs: number;
} | null;

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function fmtDuration(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

function CancelConfirmModal({ onClose, onConfirm, loading }: { onClose: () => void; onConfirm: () => void; loading: boolean }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-header">
          <span className="modal-title" style={{ color: 'var(--danger)' }}>Cancelar sessão?</span>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ background: 'var(--danger-bg)', borderRadius: 'var(--r-md)', padding: '12px 14px', fontSize: '0.85rem', color: 'var(--danger)', lineHeight: 1.5 }}>
          Essa sessão e o progresso dos ciclos serão apagados. Essa ação não pode ser desfeita.
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Voltar</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Cancelando…' : 'Cancelar sessão'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StudyTimerScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [focusMode, setFocusMode] = useState(false);

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3200);
  }

  const { data: session, isLoading } = useQuery<RawSession>({
    queryKey: ['study-timer-session'],
    queryFn: () => api('/study-timer/session'),
  });

  const tick = useStudyTimerTick(session ?? null);
  const state = tick?.state ?? null;
  const now = tick?.now.getTime() ?? Date.now();

  useWakeLock(state?.status === 'active' && !state.isPaused);

  // Installed PWAs already run chrome-less (standalone) — the Fullscreen API
  // is redundant there and unreliable on iOS home-screen apps, so focus mode
  // only drives it for regular browser tabs; hiding the bottom nav still
  // applies either way.
  const runningAsPWA = isPWA();

  useEffect(() => {
    if (runningAsPWA) return;
    function onFsChange() {
      if (!document.fullscreenElement) setFocusMode(false);
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [runningAsPWA]);

  // The app shell always reserves space for the bottom nav; when focus mode
  // hides it, release that space (but keep the safe-area inset for the
  // home-indicator area on notched devices).
  useEffect(() => {
    document.querySelector('.app-shell')?.classList.toggle('app-shell--focus', focusMode);
    return () => { document.querySelector('.app-shell')?.classList.remove('app-shell--focus'); };
  }, [focusMode]);

  async function toggleFocusMode() {
    const next = !focusMode;
    setFocusMode(next);
    if (runningAsPWA) return;
    try {
      if (next && !document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if (!next && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // fullscreen not available on this device — focus mode still hides the bottom nav
    }
  }

  const cancelMutation = useMutation({
    mutationFn: () => api('/study-timer/session', { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['study-timer-session'] });
      setShowCancelConfirm(false);
      showToast('success', 'Sessão cancelada');
    },
    onError: (e) => showToast('error', e instanceof Error ? e.message : 'Erro ao cancelar sessão'),
  });
  const pauseMutation = useMutation({
    mutationFn: () => api('/study-timer/session/pause', { method: 'POST', body: '{}' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-timer-session'] }),
    onError: (e) => showToast('error', e instanceof Error ? e.message : 'Erro ao pausar sessão'),
  });
  const resumeMutation = useMutation({
    mutationFn: () => api('/study-timer/session/resume', { method: 'POST', body: '{}' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-timer-session'] }),
    onError: (e) => showToast('error', e instanceof Error ? e.message : 'Erro ao retomar sessão'),
  });

  const passedCount = state?.checkpoints.filter((c) => c.passed).length ?? 0;
  const totalCheckpoints = state?.checkpoints.length ?? 1;
  const progressPct = state?.status === 'completed' ? 100 : Math.round((passedCount / totalCheckpoints) * 100);

  return (
    <>
      <div className="screen-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => navigate('/perfil')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
            >
              <ArrowLeft size={20} />
            </button>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Cronômetro de estudos
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => navigate('/foco/historico')}
              className="btn btn-icon"
              style={{ width: 34, height: 34 }}
              title="Histórico"
              aria-label="Histórico"
            >
              <History size={16} />
            </button>
            <button
              onClick={toggleFocusMode}
              className="btn btn-icon"
              style={{ width: 34, height: 34 }}
              title={focusMode ? 'Sair do modo foco' : 'Modo foco'}
              aria-label={focusMode ? 'Sair do modo foco' : 'Modo foco'}
            >
              {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div className="screen-body timer-body">
        {isLoading && <div className="skeleton" style={{ height: 220, borderRadius: 'var(--r-xl)' }} />}

        {!isLoading && !state && (
          <div className="empty-state">
            <Timer size={44} strokeWidth={1.2} color="var(--brand)" />
            <div className="empty-label">Nenhuma sessão agendada</div>
            <div className="empty-hint">Escolha quantos ciclos de 30 minutos e o horário de início.</div>
            <button className="btn btn-primary" style={{ marginTop: 16, gap: 6 }} onClick={() => setModal('create')}>
              <Plus size={15} />
              Nova sessão
            </button>
          </div>
        )}

        {state && (
          <>
            <div className={`timer-hero${state.status === 'completed' ? ' is-completed' : ''}${state.isPaused ? ' is-paused' : ''}`}>
              {state.status !== 'completed' && (
                <div className="timer-hero-actions">
                  {state.status === 'active' && (
                    state.isPaused ? (
                      <button
                        className="timer-hero-icon-btn"
                        onClick={() => resumeMutation.mutate()}
                        disabled={resumeMutation.isPending}
                        aria-label="Retomar sessão"
                        title="Retomar sessão"
                      >
                        {resumeMutation.isPending ? <span className="icon-spin" /> : <Play size={15} strokeWidth={2.5} />}
                      </button>
                    ) : (
                      <button
                        className="timer-hero-icon-btn"
                        onClick={() => pauseMutation.mutate()}
                        disabled={pauseMutation.isPending}
                        aria-label="Pausar sessão"
                        title="Pausar sessão"
                      >
                        {pauseMutation.isPending ? <span className="icon-spin" /> : <Pause size={15} strokeWidth={2.5} />}
                      </button>
                    )
                  )}
                  <button
                    className="timer-hero-icon-btn"
                    onClick={() => setModal('edit')}
                    aria-label="Editar sessão"
                    title="Editar sessão"
                  >
                    <Pencil size={15} strokeWidth={2.5} />
                  </button>
                  <button
                    className="timer-hero-icon-btn danger"
                    onClick={() => setShowCancelConfirm(true)}
                    aria-label="Cancelar sessão"
                    title="Cancelar sessão"
                  >
                    <X size={15} strokeWidth={2.5} />
                  </button>
                </div>
              )}

              {state.status === 'scheduled' && (
                <>
                  <div className="timer-hero-label">Começa em</div>
                  <div className="timer-hero-value">{fmtCountdown(new Date(state.startAt).getTime() - now)}</div>
                  <div className="timer-hero-sub">Início às {fmtTime(state.startAt)}</div>
                </>
              )}
              {state.status === 'active' && state.isPaused && (
                <>
                  <div className="timer-hero-label">Pausado</div>
                  <div className="timer-hero-value">{fmtCountdown(new Date(state.endAt).getTime() - now)}</div>
                  <div className="timer-hero-sub">Retome quando estiver pronto</div>
                </>
              )}
              {state.status === 'active' && !state.isPaused && (
                <>
                  <div className="timer-hero-label">Tempo restante</div>
                  <div className="timer-hero-value">{fmtCountdown(new Date(state.endAt).getTime() - now)}</div>
                  <div className="timer-hero-sub">
                    Ciclo {passedCount} de {session?.totalCycles} · termina às {fmtTime(state.endAt)}
                  </div>
                </>
              )}
              {state.status === 'completed' && (
                <>
                  <div className="timer-hero-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Sparkles size={13} /> Sessão concluída
                  </div>
                  <div className="timer-hero-value">{fmtDuration((session?.totalCycles ?? 0) * (session?.cycleMinutes ?? 30))}</div>
                  <div className="timer-hero-sub">de estudo focado — bom trabalho!</div>
                </>
              )}

              <div className="timer-hero-progress">
                <div className="timer-hero-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <CheckpointList checkpoints={state.checkpoints} active={state.status === 'active' && !state.isPaused} />

            {state.status === 'completed' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
                <button className="btn btn-primary" style={{ flex: 1, gap: 6 }} onClick={() => setModal('create')}>
                  <Plus size={15} />
                  Nova sessão
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {modal && (
        <SetupModal
          onClose={() => setModal(null)}
          session={modal === 'edit' ? session ?? null : null}
        />
      )}

      {showCancelConfirm && (
        <CancelConfirmModal
          onClose={() => setShowCancelConfirm(false)}
          onConfirm={() => cancelMutation.mutate()}
          loading={cancelMutation.isPending}
        />
      )}

      {toast && (
        <div
          className={`timer-toast timer-toast-${toast.type}`}
          style={{ bottom: focusMode ? 'calc(env(safe-area-inset-bottom) + 16px)' : 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 12px)' }}
        >
          {toast.text}
        </div>
      )}

      {!focusMode && <BottomNav />}
    </>
  );
}
