import { useEffect, useState } from 'react';
import { LogoMark } from './Logo';

function isPWA() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1400);
    const doneTimer = setTimeout(() => onDone(), 1900);
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--brand-grad)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 18,
      opacity: fading ? 0 : 1,
      transition: 'opacity 0.5s ease',
      pointerEvents: 'none',
    }}>
      <div style={{
        width: 88, height: 88,
        borderRadius: 24,
        background: 'rgba(255,255,255,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'splashPop 0.5s cubic-bezier(0.22,1,0.36,1) both',
      }}>
        <LogoMark size={56} />
      </div>
      <div style={{
        fontFamily: 'var(--font)',
        fontSize: '1.6rem', fontWeight: 800,
        letterSpacing: '-0.035em', color: 'white',
        animation: 'splashPop 0.5s 0.1s cubic-bezier(0.22,1,0.36,1) both',
      }}>
        Rotina
      </div>
      <style>{`
        @keyframes splashPop {
          from { opacity: 0; transform: scale(0.85) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

export { isPWA };
