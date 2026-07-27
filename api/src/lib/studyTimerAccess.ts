import { env } from '../env.js';

export function isStudyTimerAllowed(userId: string): boolean {
  return env.STUDY_TIMER_ALLOWED_USER_IDS
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(userId);
}
