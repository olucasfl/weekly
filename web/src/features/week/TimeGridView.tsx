import { useState, useRef, useEffect } from 'react';
import { localISO } from '../../lib/date';

const EVENT_COLOR = '#f43f5e';
const HOUR_H = 64;
const GRID_START = 5;
const GRID_END = 23;
const HOURS = Array.from({ length: GRID_END - GRID_START + 1 }, (_, i) => GRID_START + i);
const TOTAL_H = HOURS.length * HOUR_H;
const DAY_ABBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const STRIP_W = 9; // width (px) of each peeking strip on the right

type Occurrence = {
  taskId: string;
  title: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  done: boolean;
  type?: string;
  category?: { id: string; name: string; color: string } | null;
};

interface Props {
  occurrences: Occurrence[];
  weekDays: Date[];
  today: Date;
  filterCatId: string | null;
  onToggle: (taskId: string, date: string, done: boolean) => void;
}

function toMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function endMin(o: Occurrence) { return o.endTime ? toMin(o.endTime) : toMin(o.startTime) + 60; }
function timeToY(t: string) { const [h, m] = t.split(':').map(Number); return (h - GRID_START + m / 60) * HOUR_H; }
function taskHeight(o: Occurrence) { return Math.max((endMin(o) - toMin(o.startTime)) * (HOUR_H / 60), 28); }
function occKey(o: Occurrence) { return `${o.taskId}-${o.date}`; }

function overlaps(a: Occurrence, b: Occurrence) {
  return toMin(a.startTime) < endMin(b) && endMin(a) > toMin(b.startTime);
}

// Group occurrences into overlapping clusters
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

export function TimeGridView({ occurrences, weekDays, today, filterCatId, onToggle }: Props) {
  const todayISO = localISO(today);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // topKey: which task is brought to front within its cluster
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

  return (
    <div className="tgrid-wrapper" ref={wrapperRef}>
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
          const dayOccs = filtered.filter((o) => o.date === iso);
          const clusters = clusterOccs(dayOccs);

          return (
            <div key={iso} className={`tgrid-day-col${isToday ? ' today' : ''}`} style={{ height: TOTAL_H }}>
              {HOURS.map((h) => (
                <div key={h} className="tgrid-hour-line" style={{ top: (h - GRID_START) * HOUR_H }} />
              ))}

              {clusters.map((cluster) => {
                const N = cluster.length;

                // Determine which is the "front" task for this cluster
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
                    // Front task: occupies the left portion, strips peek on the right
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
                    // Strip: colored sliver on the right, always visible + clickable
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
