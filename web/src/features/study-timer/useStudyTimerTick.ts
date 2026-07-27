import { useEffect, useReducer } from 'react';
import { deriveStudySessionStateWithPause, type PausableStudySessionState } from '@shared/studyTimer';

type SessionInput = {
  startAt: string;
  totalCycles: number;
  cycleMinutes: number;
  pausedAt: string | null;
  totalPausedMs: number;
} | null;

export type StudyTimerTick = { state: PausableStudySessionState; now: Date } | null;

export function useStudyTimerTick(session: SessionInput): StudyTimerTick {
  const [, tick] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const id = setInterval(tick, 1_000);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!session) return null;
  const realNow = new Date();
  const state = deriveStudySessionStateWithPause(session, realNow);
  // Freeze the displayed "now" at the pause instant too, so remaining-time
  // countdowns built from `endAt - now` stop advancing while paused.
  const now = state.isPaused && session.pausedAt ? new Date(session.pausedAt) : realNow;
  return { state, now };
}
