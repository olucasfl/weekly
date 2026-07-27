import { env } from '../env.js';

export function isStudyTimerAllowed(userId: string): boolean {
  const allowedIds = env.STUDY_TIMER_ALLOWED_USER_IDS
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  // No allow-list configured — open to everyone. Set STUDY_TIMER_ALLOWED_USER_IDS
  // to restrict the feature back to specific accounts.
  if (allowedIds.length === 0) return true;

  return allowedIds.includes(userId);
}
