import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import type { StudyCheckpoint } from '@shared/studyTimer';

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function CheckpointList({ checkpoints }: { checkpoints: StudyCheckpoint[] }) {
  const prevPassedRef = useRef<Set<number>>(new Set());
  const [justPassed, setJustPassed] = useState<Set<number>>(new Set());

  useEffect(() => {
    const nowPassed = new Set(checkpoints.filter((c) => c.passed).map((c) => c.index));
    const newlyPassed = [...nowPassed].filter((i) => !prevPassedRef.current.has(i));
    prevPassedRef.current = nowPassed;
    if (newlyPassed.length > 0) {
      setJustPassed(new Set(newlyPassed));
      const t = setTimeout(() => setJustPassed(new Set()), 700);
      return () => clearTimeout(t);
    }
  }, [checkpoints]);

  const lastIndex = checkpoints.length - 1;

  return (
    <div className="timer-grid">
      {checkpoints.map((cp) => {
        const classes = ['timer-tile', cp.passed ? 'passed' : 'upcoming'];
        if (justPassed.has(cp.index)) classes.push('just-passed');

        return (
          <div
            key={cp.index}
            className={classes.join(' ')}
            style={{ animationDelay: `${Math.min(cp.index, 14) * 35}ms` }}
          >
            {(cp.index === 0 || cp.index === lastIndex) && (
              <span className="timer-tile-index">{cp.index === 0 ? 'Início' : 'Fim'}</span>
            )}
            <span className="timer-tile-time">{fmtTime(cp.at)}</span>
            {cp.passed && <Check size={14} className="timer-tile-check" strokeWidth={3} />}
          </div>
        );
      })}
    </div>
  );
}
