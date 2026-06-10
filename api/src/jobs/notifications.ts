import webpush from 'web-push';
import { prisma } from '../lib/prisma.js';
import { env } from '../env.js';

function pad(n: number) { return String(n).padStart(2, '0'); }

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function currentTimeMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

// Tracks sent notifications to avoid duplicates within the same minute window
const sentThisMinute = new Map<string, number>();

export function startNotificationJob() {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.warn('[push] VAPID keys not set — push notifications disabled');
    return;
  }

  webpush.setVapidDetails(env.VAPID_EMAIL, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  console.log('[push] Notification job started');

  setInterval(async () => {
    try {
      const now = new Date();
      const nowMin = currentTimeMinutes();
      const today = now.toISOString().slice(0, 10);
      const todayWeekday = now.getDay();

      // Clean up old sent records (older than 5 minutes)
      for (const [key, sentAt] of sentThisMinute) {
        if (nowMin - sentAt > 5) sentThisMinute.delete(key);
      }

      const tasks = await prisma.task.findMany({
        where: { active: true, reminder: true },
        include: { user: { include: { pushSubscriptions: true } } },
      });

      for (const task of tasks) {
        const fires =
          (task.type === 'RECURRING' && task.weekdays.includes(todayWeekday)) ||
          (task.type === 'SCHEDULED' && task.date === today);

        if (!fires) continue;

        const startMin = timeToMinutes(task.startTime);
        const reminderMin = startMin - task.reminderMin;
        if (reminderMin < 0) continue;

        // Match within a 2-minute window to handle drift/restart
        const diff = nowMin - reminderMin;
        if (diff < 0 || diff > 1) continue;

        const dedupeKey = `${task.id}-${reminderMin}`;
        if (sentThisMinute.has(dedupeKey)) continue;
        sentThisMinute.set(dedupeKey, nowMin);

        const subs = task.user.pushSubscriptions;
        if (subs.length === 0) {
          console.log(`[push] No subscriptions for user ${task.user.id}`);
          continue;
        }

        console.log(`[push] Sending reminder for "${task.title}" (${task.startTime}) to ${subs.length} device(s)`);

        const payload = JSON.stringify({
          title: 'Weekly — lembrete',
          body: `${task.title} às ${task.startTime}`,
        });

        await Promise.allSettled(
          subs.map((sub) =>
            webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
            ).catch((err) => console.error('[push] send failed:', err.message)),
          ),
        );
      }
    } catch (err) {
      console.error('[push] job error:', err);
    }
  }, 30_000); // Roda a cada 30s para não perder janelas
}
