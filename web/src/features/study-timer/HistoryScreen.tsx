import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, Clock, Trophy, Check, X as XIcon } from 'lucide-react';
import { api } from '../../lib/api';
import { BottomNav } from '../../components/BottomNav';

type HistorySession = {
  id: string;
  startAt: string;
  endAt: string;
  totalCycles: number;
  cycleMinutes: number;
  completed: boolean;
};

type History = {
  summary: { totalSessions: number; totalMinutes: number; weekMinutes: number };
  sessions: HistorySession[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
};

function fmtDuration(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', weekday: 'short' });
}

export function HistoryScreen() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data, isLoading, isPlaceholderData } = useQuery<History>({
    queryKey: ['study-timer-history', page],
    queryFn: () => api(`/study-timer/history?page=${page}`),
    placeholderData: (prev) => prev,
  });

  const summary = data?.summary;

  return (
    <>
      <div className="screen-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            onClick={() => navigate('/foco')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            <ArrowLeft size={20} />
          </button>
          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)', letterSpacing: '-0.01em', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Histórico
          </div>
        </div>
      </div>

      <div className="screen-body timer-body">
        {isLoading && (
          <>
            <div className="skeleton" style={{ height: 90, borderRadius: 'var(--r-lg)', marginBottom: 16 }} />
            {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 'var(--r-md)', marginBottom: 8 }} />)}
          </>
        )}

        {summary && (
          <div className="timer-stats-grid">
            <div className="timer-stat-tile">
              <Trophy size={18} color="var(--brand)" strokeWidth={2} />
              <div className="timer-stat-value">{summary.totalSessions}</div>
              <div className="timer-stat-label">simulados</div>
            </div>
            <div className="timer-stat-tile">
              <Clock size={18} color="var(--brand)" strokeWidth={2} />
              <div className="timer-stat-value">{fmtDuration(summary.totalMinutes)}</div>
              <div className="timer-stat-label">estudados</div>
            </div>
            <div className="timer-stat-tile">
              <TrendingUp size={18} color="var(--success)" strokeWidth={2} />
              <div className="timer-stat-value">{fmtDuration(summary.weekMinutes)}</div>
              <div className="timer-stat-label">essa semana</div>
            </div>
          </div>
        )}

        {data && data.sessions.length === 0 && (
          <div className="empty-state">
            <Clock size={44} strokeWidth={1.2} color="var(--brand)" />
            <div className="empty-label">Nenhuma sessão ainda</div>
            <div className="empty-hint">Suas sessões concluídas ou canceladas vão aparecer aqui.</div>
          </div>
        )}

        {data && data.sessions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4, opacity: isPlaceholderData ? 0.6 : 1, transition: 'opacity 0.15s' }}>
            {data.sessions.map((s) => (
              <div key={s.id} className="card-sm" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: s.completed ? 'var(--success-bg)' : 'var(--danger-bg)',
                    color: s.completed ? 'var(--success)' : 'var(--danger)',
                  }}
                >
                  {s.completed ? <Check size={14} strokeWidth={3} /> : <XIcon size={14} strokeWidth={3} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                    {fmtDate(s.startAt)}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    {fmtTime(s.startAt)}–{fmtTime(s.endAt)} · {s.totalCycles} ciclo{s.totalCycles !== 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: s.completed ? 'var(--success)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtDuration(s.totalCycles * s.cycleMinutes)}
                </div>
              </div>
            ))}
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 18 }}>
            <button
              className="btn btn-icon"
              style={{ width: 34, height: 34 }}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={data.page <= 1 || isPlaceholderData}
              aria-label="Página anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 6, minWidth: 64, justifyContent: 'center' }}>
              {isPlaceholderData ? <span className="icon-spin" style={{ borderColor: 'var(--border-strong)', borderTopColor: 'var(--brand)' }} /> : `${data.page} de ${data.totalPages}`}
            </span>
            <button
              className="btn btn-icon"
              style={{ width: 34, height: 34 }}
              disabled={data.page >= data.totalPages || isPlaceholderData}
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              aria-label="Próxima página"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      <BottomNav />
    </>
  );
}
