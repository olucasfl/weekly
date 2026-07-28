import { prisma } from '../../lib/prisma.js';
import { deriveStudySessionStateWithPause } from '../../../../shared/src/studyTimer.js';

export async function getCurrentSession(userId: string) {
  const session = await prisma.studySession.findFirst({
    where: { userId, cancelledAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!session) return null;

  const { status, endAt, checkpoints, isPaused } = deriveStudySessionStateWithPause(
    {
      startAt: session.startAt.toISOString(),
      totalCycles: session.totalCycles,
      cycleMinutes: session.cycleMinutes,
      pausedAt: session.pausedAt?.toISOString() ?? null,
      totalPausedMs: session.totalPausedMs,
    },
    new Date(),
  );

  return {
    id: session.id,
    totalCycles: session.totalCycles,
    cycleMinutes: session.cycleMinutes,
    startAt: session.startAt.toISOString(),
    pausedAt: session.pausedAt?.toISOString() ?? null,
    totalPausedMs: session.totalPausedMs,
    isPaused,
    status,
    endAt,
    checkpoints,
  };
}

export async function createSession(
  userId: string,
  input: { startAt: string; totalCycles: number; cycleMinutes: number },
) {
  return prisma.$transaction(async (tx) => {
    await tx.studySession.updateMany({
      where: { userId, cancelledAt: null },
      data: { cancelledAt: new Date() },
    });
    return tx.studySession.create({
      data: {
        userId,
        startAt: new Date(input.startAt),
        totalCycles: input.totalCycles,
        cycleMinutes: input.cycleMinutes,
      },
    });
  });
}

export async function updateSession(
  userId: string,
  input: { startAt: string; totalCycles: number; cycleMinutes: number },
) {
  const existing = await prisma.studySession.findFirst({ where: { userId, cancelledAt: null } });
  if (!existing) throw new Error('Nenhuma sessão para editar');
  await prisma.studySession.update({
    where: { id: existing.id },
    data: {
      startAt: new Date(input.startAt),
      totalCycles: input.totalCycles,
      cycleMinutes: input.cycleMinutes,
    },
  });
}

export async function pauseSession(userId: string) {
  const session = await prisma.studySession.findFirst({ where: { userId, cancelledAt: null } });
  if (!session) throw new Error('Nenhuma sessão ativa');
  if (session.pausedAt) throw new Error('Sessão já está pausada');

  const { status } = deriveStudySessionStateWithPause(
    {
      startAt: session.startAt.toISOString(),
      totalCycles: session.totalCycles,
      cycleMinutes: session.cycleMinutes,
      pausedAt: null,
      totalPausedMs: session.totalPausedMs,
    },
    new Date(),
  );
  if (status !== 'active') throw new Error('Só é possível pausar uma sessão em andamento');

  await prisma.studySession.update({ where: { id: session.id }, data: { pausedAt: new Date() } });
}

export async function resumeSession(userId: string) {
  const session = await prisma.studySession.findFirst({ where: { userId, cancelledAt: null } });
  if (!session) throw new Error('Nenhuma sessão ativa');
  if (!session.pausedAt) throw new Error('Sessão não está pausada');

  const additionalPauseMs = Date.now() - session.pausedAt.getTime();
  await prisma.studySession.update({
    where: { id: session.id },
    data: { pausedAt: null, totalPausedMs: session.totalPausedMs + additionalPauseMs },
  });
}

export async function cancelCurrentSession(userId: string) {
  const result = await prisma.studySession.updateMany({
    where: { userId, cancelledAt: null },
    data: { cancelledAt: new Date() },
  });
  if (result.count === 0) throw new Error('Nenhuma sessão ativa');
  return { success: true };
}

const HISTORY_PAGE_SIZE = 10;

export async function getHistory(userId: string, page: number) {
  const sessions = await prisma.studySession.findMany({
    where: { userId },
    orderBy: { startAt: 'desc' },
    take: 500,
  });

  const now = new Date();
  const resolved = sessions
    .map((s) => {
      const endAt = new Date(s.startAt.getTime() + s.totalPausedMs + s.totalCycles * s.cycleMinutes * 60_000);
      const finishedAt = s.cancelledAt ?? now;
      const completed = finishedAt.getTime() >= endAt.getTime();
      const isResolved = s.cancelledAt !== null || endAt.getTime() <= now.getTime();
      return {
        id: s.id,
        startAt: s.startAt.toISOString(),
        endAt: endAt.toISOString(),
        totalCycles: s.totalCycles,
        cycleMinutes: s.cycleMinutes,
        completed,
        isResolved,
      };
    })
    .filter((s) => s.isResolved);

  const completedSessions = resolved.filter((s) => s.completed);
  const totalSessions = completedSessions.length;
  const totalMinutes = completedSessions.reduce((sum, s) => sum + s.totalCycles * s.cycleMinutes, 0);

  // Calendar week Sunday→Sunday (resets every Sunday), not a rolling 7 days.
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekMinutes = completedSessions
    .filter((s) => new Date(s.startAt).getTime() >= weekStart.getTime())
    .reduce((sum, s) => sum + s.totalCycles * s.cycleMinutes, 0);

  const totalPages = Math.max(1, Math.ceil(resolved.length / HISTORY_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * HISTORY_PAGE_SIZE;
  const pageItems = resolved
    .slice(start, start + HISTORY_PAGE_SIZE)
    .map(({ isResolved: _isResolved, ...s }) => s);

  return {
    summary: { totalSessions, totalMinutes, weekMinutes },
    sessions: pageItems,
    page: safePage,
    pageSize: HISTORY_PAGE_SIZE,
    totalPages,
    totalItems: resolved.length,
  };
}
