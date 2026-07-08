import webpush from 'web-push';
import { prisma } from '../lib/prisma.js';
import { env } from '../env.js';
import { buildWeekOccurrences } from '../../../shared/src/recurrence.js';

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

// Returns current {hours, minutes, dateStr} in the given IANA timezone
function nowInZone(tz: string): { hours: number; minutes: number; dateStr: string } {
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
    const hours = parseInt(get('hour')) % 24; // normalize 24→0
    return {
      hours,
      minutes: parseInt(get('minute')),
      dateStr: `${get('year')}-${get('month')}-${get('day')}`,
    };
  } catch {
    // Invalid timezone fallback to UTC
    return {
      hours: now.getUTCHours(),
      minutes: now.getUTCMinutes(),
      dateStr: now.toISOString().slice(0, 10),
    };
  }
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
      // Load all active tasks with reminders + user subscriptions
      const tasks = await prisma.task.findMany({
        where: { active: true, reminder: true, deletedAt: null },
        include: { user: { include: { pushSubscriptions: true } } },
      });

      if (tasks.length === 0) return;

      // Group by userId so we run recurrence logic once per user
      const byUser = new Map<string, typeof tasks>();
      for (const t of tasks) {
        const list = byUser.get(t.userId) ?? [];
        list.push(t);
        byUser.set(t.userId, list);
      }

      for (const [, userTasks] of byUser) {
        const subs = userTasks[0].user.pushSubscriptions;
        if (subs.length === 0) continue;

        // Use the timezone stored with the first subscription (all from same user)
        const tz = (subs[0] as { timezone?: string })?.timezone ?? 'UTC';
        const { hours, minutes, dateStr } = nowInZone(tz);
        const nowMin = hours * 60 + minutes;

        // Clean stale dedupe entries (older than 5 minutes)
        for (const [key, sentAt] of sentThisMinute) {
          if (nowMin - sentAt > 5) sentThisMinute.delete(key);
        }

        // Build today's occurrences using the shared recurrence engine
        // This correctly handles weekly, biweekly, monthly_date, monthly_weekday
        const taskLikes = userTasks.map(t => ({
          id: t.id,
          title: t.title,
          type: t.type as 'RECURRING' | 'SCHEDULED',
          weekdays: t.weekdays,
          date: t.date ?? undefined,
          endDate: t.endDate ?? undefined,
          startTime: t.startTime,
          endTime: t.endTime ?? undefined,
          reminder: t.reminder,
          reminderMin: t.reminderMin,
          active: t.active,
          recurrenceType: t.recurrenceType,
          biweeklyAnchor: t.biweeklyAnchor ?? undefined,
          monthlyDay: t.monthlyDay ?? undefined,
          monthlyWeekday: t.monthlyWeekday ?? undefined,
          monthlyWeek: t.monthlyWeek ?? undefined,
        }));

        const todayOccs = buildWeekOccurrences(taskLikes, mondayOf(dateStr));
        const todayTaskIds = new Set(
          todayOccs.filter(o => o.date === dateStr).map(o => o.task.id)
        );

        for (const task of userTasks) {
          if (!todayTaskIds.has(task.id)) continue;

          const startMin = timeToMinutes(task.startTime);
          const reminderAt = startMin - task.reminderMin;
          if (reminderAt < 0) continue;

          const diff = nowMin - reminderAt;
          if (diff < 0 || diff > 1) continue; // 2-minute window

          const dedupeKey = `${task.id}-${dateStr}-${reminderAt}`;
          if (sentThisMinute.has(dedupeKey)) continue;
          sentThisMinute.set(dedupeKey, nowMin);

          console.log(`[push] Sending reminder for "${task.title}" (${task.startTime}, tz=${tz}) to ${subs.length} device(s)`);

          const payload = JSON.stringify({
            title: 'Weekly — lembrete',
            body: `${task.title} às ${task.startTime}`,
          });

          await Promise.allSettled(
            subs.map(sub =>
              webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload,
              ).catch(err => {
                console.error('[push] send failed:', err.message);
                // Remove expired/invalid subscriptions (410 Gone or 404)
                if (err.statusCode === 410 || err.statusCode === 404) {
                  prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } }).catch(() => {});
                }
              }),
            ),
          );
        }
      }
    } catch (err) {
      console.error('[push] job error:', err);
    }
  }, 30_000);
}
