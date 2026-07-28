export type StudySessionInput = {
  startAt: string;
  totalCycles: number;
  cycleMinutes: number;
};

export type StudySessionStatus = 'scheduled' | 'active' | 'completed';

export type StudyCheckpoint = {
  index: number;
  at: string;
  passed: boolean;
};

export type StudySessionState = {
  status: StudySessionStatus;
  startAt: string;
  endAt: string;
  checkpoints: StudyCheckpoint[];
};

export function deriveStudySessionState(session: StudySessionInput, now: Date): StudySessionState {
  const startMs = new Date(session.startAt).getTime();
  const cycleMs = session.cycleMinutes * 60_000;
  const nowMs = now.getTime();

  const checkpoints: StudyCheckpoint[] = [];
  for (let i = 0; i <= session.totalCycles; i++) {
    const at = startMs + i * cycleMs;
    checkpoints.push({ index: i, at: new Date(at).toISOString(), passed: nowMs >= at });
  }

  const endMs = startMs + session.totalCycles * cycleMs;
  const status: StudySessionStatus = nowMs < startMs ? 'scheduled' : nowMs >= endMs ? 'completed' : 'active';

  return {
    status,
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(endMs).toISOString(),
    checkpoints,
  };
}

export type PausableSessionInput = StudySessionInput & {
  pausedAt?: string | null;
  totalPausedMs?: number;
};

export type PausableStudySessionState = StudySessionState & { isPaused: boolean };

/**
 * Same as deriveStudySessionState, but shifts the whole schedule forward by
 * previously-accumulated pause time, and — while currently paused — freezes
 * the clock at the moment the pause began instead of at `now`.
 */
export function deriveStudySessionStateWithPause(session: PausableSessionInput, now: Date): PausableStudySessionState {
  const totalPausedMs = session.totalPausedMs ?? 0;
  const effectiveStartAt = new Date(new Date(session.startAt).getTime() + totalPausedMs).toISOString();
  const isPaused = !!session.pausedAt;
  const effectiveNow = isPaused ? new Date(session.pausedAt as string) : now;

  const state = deriveStudySessionState(
    { startAt: effectiveStartAt, totalCycles: session.totalCycles, cycleMinutes: session.cycleMinutes },
    effectiveNow,
  );

  return { ...state, isPaused };
}
