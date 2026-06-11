import { useQueries, useQuery } from '@tanstack/react-query';
import { Flame, TrendingUp, Clock, Target, Trophy, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { localISO, weekStartOf, addDays } from '../../lib/date';
import { BottomNav } from '../../components/BottomNav';
import { StatBoxSkeleton } from '../../components/Skeleton';

type Dashboard = {
  weekStart: string;
  completed: number;
  pending: number;
  total: number;
  percent: number;
  streak: number;
  byCategory: { name: string; color: string; completed: number; total: number }[];
  goals?: { total: number; completed: number; percent: number };
};

const MONTH_ABBR = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

function getWeekStartISO() { return localISO(weekStartOf()); }

function getPastWeekStarts(n: number): string[] {
  const result: string[] = [];
  let cur = weekStartOf();
  for (let i = 0; i < n; i++) {
    result.unshift(localISO(cur));
    cur = addDays(cur, -7);
  }
  return result;
}

function weekLabel(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`;
}

export function ProgressScreen() {
  const navigate = useNavigate();
  const weekStart = getWeekStartISO();

  const { data: dashboard, isLoading } = useQuery<Dashboard>({
    queryKey: ['dashboard', weekStart],
    queryFn: () => api(`/dashboard?start=${weekStart}`),
  });

  // Last 8 weeks for history
  const pastWeekStarts = getPastWeekStarts(8);
  const historyQueries = useQueries({
    queries: pastWeekStarts.map((ws) => ({
      queryKey: ['dashboard', ws],
      queryFn: () => api<Dashboard>(`/dashboard?start=${ws}`),
      staleTime: 5 * 60_000,
    })),
  });

  const percent = dashboard?.percent ?? 0;

  return (
    <>
      <div className="screen-header">
        <div className="screen-title">Progresso</div>
        <div className="screen-subtitle">Desempenho da semana atual</div>
      </div>

      <div className="screen-body">
        {/* Stats */}
        <div className="stat-grid">
          {isLoading ? (
            <>
              <StatBoxSkeleton />
              <StatBoxSkeleton />
              <StatBoxSkeleton />
              <StatBoxSkeleton />
            </>
          ) : null}
          {!isLoading && <div className="stat-box">
            <div className="row" style={{ gap: 6, marginBottom: 6 }}>
              <TrendingUp size={14} color="var(--brand)" strokeWidth={2} />
              <span className="text-xs text-muted">Concluído</span>
            </div>
            <div className="stat-val">{percent}%</div>
          </div>}
          {!isLoading && <div className="stat-box">
            <div className="row" style={{ gap: 6, marginBottom: 6 }}>
              <Flame size={14} color="#f97316" strokeWidth={2} />
              <span className="text-xs text-muted">Sequência</span>
            </div>
            <div className="stat-val">{dashboard?.streak ?? 0}</div>
            <div className="stat-label">dias seguidos</div>
          </div>}
          {!isLoading && <div className="stat-box">
            <div className="row" style={{ gap: 6, marginBottom: 6 }}>
              <Target size={14} color="var(--success)" strokeWidth={2} />
              <span className="text-xs text-muted">Feitas</span>
            </div>
            <div className="stat-val" style={{ color: 'var(--success)' }}>{dashboard?.completed ?? 0}</div>
          </div>}
          {!isLoading && <div className="stat-box">
            <div className="row" style={{ gap: 6, marginBottom: 6 }}>
              <Clock size={14} color="var(--text-muted)" strokeWidth={2} />
              <span className="text-xs text-muted">Pendentes</span>
            </div>
            <div className="stat-val" style={{ color: 'var(--text-secondary)' }}>{dashboard?.pending ?? 0}</div>
          </div>}
        </div>

        {/* Weekly progress bar */}
        <div className="card" style={{ padding: '18px 18px' }}>
          <div className="row-between" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Semana atual</span>
            <span className="pill pill-sm">{percent}%</span>
          </div>
          <div className="progress-bar-track" style={{ height: 8 }}>
            <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
          </div>
          <div className="text-xs text-muted" style={{ marginTop: 10 }}>
            {dashboard?.completed ?? 0} de {dashboard?.total ?? 0} tarefas concluídas
          </div>
        </div>

        {/* Goals summary */}
        {!isLoading && (dashboard?.goals?.total ?? 0) > 0 && (
          <button
            onClick={() => navigate('/metas')}
            style={{
              width: '100%', textAlign: 'left', cursor: 'pointer',
              background: 'var(--brand-grad)', borderRadius: 'var(--r-lg)',
              padding: '16px 18px', border: 'none', color: 'white',
              boxShadow: 'var(--shadow-brand)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Trophy size={15} />
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Metas da semana</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>{dashboard!.goals!.percent}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${dashboard!.goals!.percent}%`, background: 'white', borderRadius: 99 }} />
            </div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: 8 }}>
              {dashboard!.goals!.completed} de {dashboard!.goals!.total} concluída{dashboard!.goals!.total !== 1 ? 's' : ''}
              <span style={{ marginLeft: 8, opacity: 0.7, display: 'inline-flex', alignItems: 'center', gap: 3 }}>· Ver tudo <ArrowRight size={11} /></span>
            </div>
          </button>
        )}

        {/* Week history */}
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 16 }}>Histórico — 8 semanas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {historyQueries.map((q, i) => {
              const ws = pastWeekStarts[i];
              const pct = q.data?.percent ?? 0;
              const isCurrentWeek = ws === weekStart;
              return (
                <div key={ws} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.72rem', minWidth: 44, textAlign: 'right', fontWeight: isCurrentWeek ? 700 : 400, color: isCurrentWeek ? 'var(--brand)' : 'var(--text-muted)' }}>
                    {weekLabel(ws)}
                  </span>
                  <div className="progress-bar-track" style={{ flex: 1 }}>
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${pct}%`, background: isCurrentWeek ? 'var(--brand-grad)' : 'var(--brand-mid)' }}
                    />
                  </div>
                  <span style={{ fontSize: '0.72rem', minWidth: 32, textAlign: 'right', fontWeight: 600, color: isCurrentWeek ? 'var(--brand)' : 'var(--text-secondary)' }}>
                    {q.isLoading ? '…' : `${pct}%`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* By category */}
        {(dashboard?.byCategory?.length ?? 0) > 0 && (
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 16 }}>Por categoria</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {dashboard!.byCategory.map((cat) => (
                <div key={cat.name}>
                  <div className="row-between" style={{ marginBottom: 6 }}>
                    <div className="row">
                      <div className="cat-dot" style={{ background: cat.color }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{cat.name}</span>
                    </div>
                    <span className="text-xs text-muted">{cat.completed}/{cat.total}</span>
                  </div>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${cat.total > 0 ? (cat.completed / cat.total) * 100 : 0}%`, background: cat.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </>
  );
}
