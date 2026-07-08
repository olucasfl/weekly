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

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(futureDateStr: string, todayStr: string): number {
  const a = new Date(futureDateStr + 'T12:00:00Z');
  const b = new Date(todayStr + 'T12:00:00Z');
  return Math.round((a.getTime() - b.getTime()) / (86400 * 1000));
}

function nextMonthlyDateOccurrence(day: number, todayStr: string): string {
  const today = new Date(todayStr + 'T12:00:00Z');
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const todayDay = today.getUTCDate();
  const daysThis = new Date(year, month + 1, 0).getDate();
  const effectiveThis = Math.min(day, daysThis);
  if (effectiveThis >= todayDay) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(effectiveThis).padStart(2, '0')}`;
  }
  const nm = month + 1;
  const ny = nm === 12 ? year + 1 : year;
  const nmi = nm % 12;
  const daysNext = new Date(ny, nmi + 1, 0).getDate();
  return `${ny}-${String(nmi + 1).padStart(2, '0')}-${String(Math.min(day, daysNext)).padStart(2, '0')}`;
}

function nextYearlyOccurrence(month: number, day: number, todayStr: string): string {
  const today = new Date(todayStr + 'T12:00:00Z');
  const year = today.getUTCFullYear();
  const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const effectDay = (month === 2 && day === 29 && !isLeap(year)) ? 28 : day;
  const thisYear = `${year}-${String(month).padStart(2, '0')}-${String(effectDay).padStart(2, '0')}`;
  if (thisYear >= todayStr) return thisYear;
  const ny = year + 1;
  const nextDay = (month === 2 && day === 29 && !isLeap(ny)) ? 28 : day;
  return `${ny}-${String(month).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
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
    return {
      hours: now.getUTCHours(),
      minutes: now.getUTCMinutes(),
      dateStr: now.toISOString().slice(0, 10),
    };
  }
}

// Tracks sent notifications to avoid duplicates within the same minute window
const sentThisMinute = new Map<string, number>();

async function sendToSubs(
  subs: { endpoint: string; p256dh: string; auth: string }[],
  payload: string,
): Promise<void> {
  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      ).catch(err => {
        console.error('[push] send failed:', err.message);
        if (err.statusCode === 410 || err.statusCode === 404) {
          prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } }).catch(() => {});
        }
      }),
    ),
  );
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
      // Load all active tasks that have reminder enabled OR are marked as important
      const tasks = await prisma.task.findMany({
        where: {
          active: true,
          deletedAt: null,
          OR: [{ reminder: true }, { important: true }],
        },
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

        const tz = (subs[0] as { timezone?: string })?.timezone ?? 'UTC';
        const { hours, minutes, dateStr } = nowInZone(tz);
        const nowMin = hours * 60 + minutes;

        // Clean stale dedupe entries (older than 5 minutes)
        for (const [key, sentAt] of sentThisMinute) {
          if (nowMin - sentAt > 5) sentThisMinute.delete(key);
        }

        // Build shared taskLikes for recurrence engine
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          yearlyMonth: (t as any).yearlyMonth ?? undefined,
        }));

        // ── 1. Same-day reminders (reminderMin < 1440) ──────────────────
        const reminderTasks = userTasks.filter(t => t.reminder && t.reminderMin < 1440);
        if (reminderTasks.length > 0) {
          const todayOccs = buildWeekOccurrences(taskLikes, mondayOf(dateStr));
          const todayTaskIds = new Set(
            todayOccs.filter(o => o.date === dateStr).map(o => o.task.id)
          );

          for (const task of reminderTasks) {
            if (!todayTaskIds.has(task.id)) continue;

            const startMin = timeToMinutes(task.startTime);
            const reminderAt = startMin - task.reminderMin;
            if (reminderAt < 0) continue;

            const diff = nowMin - reminderAt;
            if (diff < 0 || diff > 1) continue;

            const dedupeKey = `${task.id}-${dateStr}-${reminderAt}`;
            if (sentThisMinute.has(dedupeKey)) continue;
            sentThisMinute.set(dedupeKey, nowMin);

            console.log(`[push] Reminder "${task.title}" (${task.startTime}, tz=${tz})`);
            await sendToSubs(subs, JSON.stringify({
              title: 'Weekly — lembrete',
              body: `${task.title} às ${task.startTime}`,
            }));
          }
        }

        // ── 2. Day-level reminders (reminderMin >= 1440, e.g. 1 day before) ──
        const dayLevelTasks = userTasks.filter(t => t.reminder && t.reminderMin >= 1440);
        if (dayLevelTasks.length > 0) {
          // Group by reminderDays to call buildWeekOccurrences only once per unique offset
          const grouped = new Map<number, typeof dayLevelTasks>();
          for (const task of dayLevelTasks) {
            const days = Math.floor(task.reminderMin / 1440);
            grouped.set(days, [...(grouped.get(days) ?? []), task]);
          }

          for (const [reminderDays, tasks] of grouped) {
            const targetDate = addDays(dateStr, reminderDays);
            const futureOccs = buildWeekOccurrences(taskLikes, mondayOf(targetDate));
            const futureTaskIds = new Set(
              futureOccs.filter(o => o.date === targetDate).map(o => o.task.id)
            );

            for (const task of tasks) {
              if (!futureTaskIds.has(task.id)) continue;

              const startMin = timeToMinutes(task.startTime);
              const diff = nowMin - startMin;
              if (diff < 0 || diff > 1) continue;

              const dedupeKey = `day-${task.id}-${dateStr}-${reminderDays}`;
              if (sentThisMinute.has(dedupeKey)) continue;
              sentThisMinute.set(dedupeKey, nowMin);

              const timeLabel = reminderDays === 1
                ? `amanhã às ${task.startTime}`
                : `em ${reminderDays} dias às ${task.startTime}`;

              console.log(`[push] Day-level reminder "${task.title}" (in ${reminderDays} days, tz=${tz})`);
              await sendToSubs(subs, JSON.stringify({
                title: 'Weekly — lembrete',
                body: `${task.title} ${timeLabel}`,
              }));
            }
          }
        }

        // ── 3. Countdown for important events ───────────────────────────
        for (const task of userTasks) {
          if (!task.important || !task.countdownDays) continue;

          let targetDate: string | null = null;
          if (task.type === 'SCHEDULED' && task.date) {
            targetDate = task.date;
          } else if (task.recurrenceType === 'monthly_date' && task.monthlyDay) {
            targetDate = nextMonthlyDateOccurrence(task.monthlyDay, dateStr);
          } else if (task.recurrenceType === 'yearly' && task.monthlyDay && (task as unknown as { yearlyMonth?: number }).yearlyMonth) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            targetDate = nextYearlyOccurrence((task as any).yearlyMonth, task.monthlyDay, dateStr);
          }
          if (!targetDate) continue;

          const daysUntil = diffDays(targetDate, dateStr);
          if (daysUntil <= 0 || daysUntil > task.countdownDays) continue;

          const startMin = timeToMinutes(task.startTime);
          const diff = nowMin - startMin;
          if (diff < 0 || diff > 1) continue;

          const dedupeKey = `countdown-${task.id}-${dateStr}-${daysUntil}`;
          if (sentThisMinute.has(dedupeKey)) continue;
          sentThisMinute.set(dedupeKey, nowMin);

          const body = daysUntil === 1
            ? `falta 1 dia para ${task.title}`
            : `faltam ${daysUntil} dias para ${task.title}`;

          console.log(`[push] Countdown "${task.title}" (${daysUntil} days left, tz=${tz})`);
          await sendToSubs(subs, JSON.stringify({
            title: 'Weekly — evento importante ★',
            body,
          }));
        }
      }
    } catch (err) {
      console.error('[push] job error:', err);
    }
  }, 30_000);
}
