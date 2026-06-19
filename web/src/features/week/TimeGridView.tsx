import { useState, useRef, useEffect } from 'react';
import { localISO } from '../../lib/date';
import { EVENT_COLOR } from '../../lib/constants';
const HOUR_H = 64;
const GRID_START = 0;
const GRID_END = 23;
const HOURS = Array.from({ length: GRID_END - GRID_START + 1 }, (_, i) => GRID_START + i);
const TOTAL_H = HOURS.length * HOUR_H;
const DAY_ABBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const STRIP_W = 9;
// Must match CSS: tgrid-corner width + tgrid-day-col width
const CORNER_W = 44;
const COL_W = 68;

type Occurrence = {
  taskId: string;
  title: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  done: boolean;
  type?: string;
  category?: { id: string; name: string; color: string } | null;
  isMultiDay?: boolean;
  multiDayPos?: 'start' | 'middle' | 'end' | null;
  endDate?: string | null;
};

interface Props {
  occurrences: Occurrence[];
  weekDays: Date[];
  today: Date;
  filterCatId: string | null;
  onToggle: (taskId: string, date: string, done: boolean) => void;
}

function toMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function endMin(o: Occurrence) {
  if (!o.endTime) return toMin(o.startTime) + 60;
  const em = toMin(o.endTime);
  const sm = toMin(o.startTime);
  return em < sm ? em + 24 * 60 : em; // cruza meia-noite
}
function timeToY(t: string) { const [h, m] = t.split(':').map(Number); return (h - GRID_START + m / 60) * HOUR_H; }
function taskHeight(o: Occurrence) {
  const start = toMin(o.startTime);
  const end = Math.min(endMin(o), (GRID_END + 1) * 60); // limita na borda inferior da grade
  return Math.max((end - start) * (HOUR_H / 60), 28);
}
function occKey(o: Occurrence) { return `${o.taskId}-${o.date}`; }

function overlaps(a: Occurrence, b: Occurrence) {
  return toMin(a.startTime) < endMin(b) && endMin(a) > toMin(b.startTime);
}

function clusterOccs(occs: Occurrence[]): Occurrence[][] {
  const sorted = [...occs].sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
  const clusters: Occurrence[][] = [];
  for (const occ of sorted) {
    const hit = clusters.find((cl) => cl.some((o) => overlaps(o, occ)));
    if (hit) hit.push(occ);
    else clusters.push([occ]);
  }
  return clusters;
}

// Group multi-day occurrences by taskId and compute their week column span
type MultiDayBand = {
  taskId: string;
  title: string;
  color: string;
  colStart: number; // 0-6 index into weekDays
  colEnd: number;
  startTime: string;
  endTime?: string | null;
  endDate?: string | null;
  done: boolean;
};

function buildMultiDayBands(occs: Occurrence[], weekDayISOs: string[]): MultiDayBand[] {
  const byTask = new Map<string, Occurrence[]>();
  for (const o of occs) {
    if (!o.isMultiDay) continue;
    const arr = byTask.get(o.taskId) ?? [];
    arr.push(o);
    byTask.set(o.taskId, arr);
  }
  const bands: MultiDayBand[] = [];
  for (const [taskId, group] of byTask) {
    const dates = group.map((o) => o.date).sort();
    const colStart = weekDayISOs.indexOf(dates[0]);
    const colEnd = weekDayISOs.indexOf(dates[dates.length - 1]);
    if (colStart === -1 || colEnd === -1) continue;
    const rep = group[0];
    bands.push({
      taskId,
      title: rep.title,
      color: rep.category?.color ?? EVENT_COLOR,
      colStart,
      colEnd,
      startTime: rep.startTime,
      endTime: rep.endTime,
      endDate: rep.endDate,
      done: group.every((o) => o.done),
    });
  }
  return bands;
}

export function TimeGridView({ occurrences, weekDays, today, filterCatId, onToggle }: Props) {
  const todayISO = localISO(today);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [topKey, setTopKey] = useState<string | null>(null);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const now = new Date();
    wrapperRef.current.scrollTop = Math.max((now.getHours() - GRID_START - 1) * HOUR_H, 0);
  }, []);

  useEffect(() => { setTopKey(null); }, [occurrences]);

  const filtered = filterCatId
    ? occurrences.filter((o) => o.category?.id === filterCatId)
    : occurrences;

  const weekDayISOs = weekDays.map((d) => localISO(d));
  const multiDayBands = buildMultiDayBands(filtered, weekDayISOs);
  const regularOccs = filtered.filter((o) => !o.isMultiDay);

  return (
    <div className="tgrid-wrapper" ref={wrapperRef}>
      {/* ─── Day headers ─────────────────────────────────────────── */}
      <div className="tgrid-header">
        <div className="tgrid-corner" />
        {weekDays.map((d) => {
          const iso = localISO(d);
          const isToday = iso === todayISO;
          return (
            <div key={iso} className={`tgrid-day-header${isToday ? ' today' : ''}`}>
              <div className="tgrid-day-name">{DAY_ABBR[d.getDay()]}</div>
              <div className={`tgrid-day-num${isToday ? ' today' : ''}`}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>

      {/* ─── All-day / multi-day banner ──────────────────────────── */}
      {multiDayBands.length > 0 && (
        <div className="tgrid-allday">
          <div className="tgrid-allday-label">todo dia</div>
          <div
            className="tgrid-allday-grid"
            style={{ position: 'relative', height: multiDayBands.length * 28 + 8 }}
          >
            {multiDayBands.map((band, i) => {
              const left = band.colStart * COL_W + 2;
              const width = (band.colEnd - band.colStart + 1) * COL_W - 4;
              const timeLabel = band.endDate
                ? `${band.startTime} → ${band.endTime || ''}`
                : band.startTime;
              return (
                <div
                  key={band.taskId}
                  className={`tgrid-allday-band${band.done ? ' done' : ''}`}
                  style={{
                    background: band.color,
                    left,
                    width,
                    top: 4 + i * 28,
                  }}
                  title={`${band.title} · ${timeLabel}`}
                >
                  <span className="tgrid-allday-band-title">{band.title}</span>
                  <span className="tgrid-allday-band-time">{timeLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Time grid body ──────────────────────────────────────── */}
      <div className="tgrid-body">
        <div className="tgrid-time-col">
          {HOURS.map((h) => (
            <div key={h} className="tgrid-hour-label">
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {weekDays.map((d) => {
          const iso = localISO(d);
          const isToday = iso === todayISO;
          const dayOccs = regularOccs.filter((o) => o.date === iso);
          const clusters = clusterOccs(dayOccs);

          return (
            <div key={iso} className={`tgrid-day-col${isToday ? ' today' : ''}`} style={{ height: TOTAL_H }}>
              {HOURS.map((h) => (
                <div key={h} className="tgrid-hour-line" style={{ top: (h - GRID_START) * HOUR_H }} />
              ))}

              {clusters.map((cluster) => {
                const N = cluster.length;
                const frontOcc = N > 1 && topKey && cluster.find((o) => occKey(o) === topKey)
                  ? cluster.find((o) => occKey(o) === topKey)!
                  : cluster[0];
                const strips = cluster.filter((o) => o !== frontOcc);

                return cluster.map((occ) => {
                  const key = occKey(occ);
                  const isFront = occ === frontOcc;
                  const top = timeToY(occ.startTime);
                  const height = taskHeight(occ);
                  const bg = occ.category?.color ?? (occ.type === 'SCHEDULED' ? EVENT_COLOR : 'var(--brand)');

                  if (isFront) {
                    const rightMargin = 2 + (N - 1) * STRIP_W;
                    return (
                      <div
                        key={key}
                        className={`tgrid-task${occ.done ? ' done' : ''}`}
                        style={{ top, height, background: bg, left: 2, right: rightMargin, zIndex: N + 1 }}
                      >
                        <div className="tgrid-task-title">{occ.title}</div>
                        {height >= 36 && (
                          <div className="tgrid-task-time">
                            {occ.startTime}{occ.endTime ? `–${occ.endTime}` : ''}
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    const stripIdx = strips.indexOf(occ);
                    return (
                      <div
                        key={key}
                        className={`tgrid-strip${occ.done ? ' done' : ''}`}
                        style={{
                          top, height, background: bg,
                          right: 2 + stripIdx * STRIP_W,
                          width: STRIP_W - 1,
                          zIndex: stripIdx + 1,
                        }}
                        onClick={() => setTopKey(key)}
                        title={occ.title}
                      />
                    );
                  }
                });
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
