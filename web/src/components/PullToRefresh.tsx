import { useEffect, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';

const THRESHOLD = 72;
const MAX_PULL  = 96;
const INDICATOR = 40;

function scrollableParentTop(target: EventTarget | null): number {
  let el = target as HTMLElement | null;
  while (el && el !== document.body) {
    const ov = window.getComputedStyle(el).overflowY;
    if ((ov === 'auto' || ov === 'scroll') && el.scrollTop > 0) return el.scrollTop;
    el = el.parentElement;
  }
  return 0;
}

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [displayY,   setDisplayY]   = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [animate,    setAnimate]    = useState(false);

  const pullYRef       = useRef(0);
  const startYRef      = useRef(0);
  const pullingRef     = useRef(false);
  const vibratedRef    = useRef(false);
  const refreshingRef  = useRef(false);

  useEffect(() => {
    function onStart(e: TouchEvent) {
      if (refreshingRef.current) return;
      if (window.scrollY > 0) return;
      if (scrollableParentTop(e.target) > 0) return;
      startYRef.current  = e.touches[0].clientY;
      pullingRef.current = true;
      vibratedRef.current = false;
    }

    function onMove(e: TouchEvent) {
      if (!pullingRef.current) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) { pullYRef.current = 0; setDisplayY(0); return; }
      const val = Math.min(delta * 0.55, MAX_PULL);
      pullYRef.current = val;
      setDisplayY(val);
      if (val >= THRESHOLD && !vibratedRef.current) {
        vibratedRef.current = true;
        if ('vibrate' in navigator) navigator.vibrate(30);
      }
    }

    function onEnd() {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      const pulled = pullYRef.current;
      pullYRef.current = 0;

      if (pulled >= THRESHOLD) {
        refreshingRef.current = true;
        setAnimate(true);
        setRefreshing(true);
        setDisplayY(Math.round(THRESHOLD * 0.75));
        // Aguarda o spinner aparecer antes de recarregar
        setTimeout(() => window.location.reload(), 400);
      } else {
        setAnimate(true);
        setDisplayY(0);
        setTimeout(() => setAnimate(false), 350);
      }
    }

    document.addEventListener('touchstart',  onStart, { passive: true });
    document.addEventListener('touchmove',   onMove,  { passive: true });
    document.addEventListener('touchend',    onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart',  onStart);
      document.removeEventListener('touchmove',   onMove);
      document.removeEventListener('touchend',    onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  const translateY = displayY - INDICATOR - 6;
  const progress   = Math.min(displayY / THRESHOLD, 1);

  return (
    <>
      <div
        aria-hidden
        style={{
          position:   'fixed',
          top:        'env(safe-area-inset-top, 0px)',
          left:       '50%',
          transform:  `translateX(-50%) translateY(${translateY}px)`,
          transition: animate ? 'transform 0.3s cubic-bezier(0.22,1,0.36,1)' : 'none',
          zIndex:     9999,
          width:      INDICATOR,
          height:     INDICATOR,
          borderRadius: '50%',
          background:   'var(--bg-surface)',
          boxShadow:    '0 2px 12px rgba(0,0,0,0.13)',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          opacity:     Math.max(progress * 2, refreshing ? 1 : 0),
        }}
      >
        {refreshing ? (
          <div
            className="spinner"
            style={{ width: 18, height: 18, margin: 0, borderWidth: 2.5 }}
          />
        ) : (
          <RotateCw
            size={18}
            strokeWidth={2.2}
            color="var(--brand)"
            style={{
              transform:  `rotate(${progress * 360}deg)`,
              transition: animate ? 'transform 0.3s' : 'none',
            }}
          />
        )}
      </div>
      {children}
    </>
  );
}
