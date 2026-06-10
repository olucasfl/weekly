import webpush from 'web-push';
import { prisma } from '../lib/prisma.js';
import { env } from '../env.js';

function pad(n: number) { return String(n).padStart(2, '0'); }

function reminderTimeFor(startTime: string, reminderMin: number): string {
  const [h, m] = startTime.split(':').map(Number);
  const total = h * 60 + m - reminderMin;
  const rh = Math.floor(total / 60);
  const rm = total % 60;
  if (rh < 0) return '';
  return `${pad(rh)}:${pad(rm)}`;
}

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
      const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const today = now.toISOString().slice(0, 10);
      const todayWeekday = now.getDay();

      const tasks = await prisma.task.findMany({
        where: { active: true, reminder: true },
        include: { user: { include: { pushSubscriptions: true } } },
      });

      for (const task of tasks) {
        const fires =
          (task.type === 'RECURRING' && task.weekdays.includes(todayWeekday)) ||
          (task.type === 'SCHEDULED' && task.date === today);

        if (!fires) continue;

        const rt = reminderTimeFor(task.startTime, task.reminderMin);
        if (rt !== currentTime) continue;

        const subs = task.user.pushSubscriptions;
        if (subs.length === 0) continue;

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
  }, 60_000);
}
