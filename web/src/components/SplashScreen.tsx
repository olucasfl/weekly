import { useEffect, useState } from 'react';

export function isPWA() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator &&
      (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

const SPARKLES = [
  { top: '9%',  left: '18%',  delay: '0.9s',  size: 5 },
  { top: '7%',  right: '22%', delay: '1.2s',  size: 4 },
  { top: '42%', left: '6%',   delay: '0.7s',  size: 6 },
  { top: '38%', right: '8%',  delay: '1.4s',  size: 4 },
  { bottom: '18%', left: '25%',  delay: '1.0s',  size: 5 },
  { bottom: '14%', right: '20%', delay: '1.3s',  size: 6 },
  { top: '60%', left: '15%',  delay: '1.6s',  size: 3 },
  { top: '55%', right: '14%', delay: '0.8s',  size: 4 },
];

function PillCard({ label, sub, color }: { label: string; sub: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.08)',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 13,
      padding: '9px 13px',
      display: 'flex', alignItems: 'center', gap: 9,
      minWidth: 134,
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: color, flexShrink: 0,
        boxShadow: `0 0 8px ${color}`,
      }} />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{
          fontSize: '0.79rem', fontWeight: 700,
          color: 'rgba(255,255,255,0.93)',
          fontFamily: 'DM Sans, sans-serif',
          whiteSpace: 'nowrap',
        }}>
          {label}
        </div>
        <div style={{
          fontSize: '0.64rem',
          color: 'rgba(255,255,255,0.42)',
          fontFamily: 'DM Sans, sans-serif',
          marginTop: 2, whiteSpace: 'nowrap',
        }}>
          {sub}
        </div>
      </div>
      <div style={{
        width: 19, height: 19, borderRadius: 5, flexShrink: 0,
        background: `${color}22`,
        border: `1px solid ${color}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <polyline
            points="1,4 3.5,6.5 9,1"
            stroke={color} strokeWidth="1.9"
            strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'in' | 'out'>('in');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('out'), 2300);
    const t2 = setTimeout(onDone, 2850);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(160deg, #130728 0%, #2d1065 40%, #5b21b6 80%, #7c3aed 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      opacity: phase === 'out' ? 0 : 1,
      transition: 'opacity 0.55s ease',
      pointerEvents: 'none',
      userSelect: 'none',
    }}>
      <style>{`
        @keyframes blob1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(28px,-22px) scale(1.07)} }
        @keyframes blob2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-22px,28px) scale(1.09)} }
        @keyframes blob3 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(18px,18px)} }

        @keyframes ringOut {
          from { transform:scale(0.4); opacity:0.6; }
          to   { transform:scale(2.6); opacity:0; }
        }

        @keyframes logoBounce {
          0%   { opacity:0; transform:scale(0.25) translateY(-60px); }
          55%  { opacity:1; transform:scale(1.18) translateY(6px); }
          72%  { transform:scale(0.91) translateY(-2px); }
          88%  { transform:scale(1.05); }
          100% { transform:scale(1); }
        }
        @keyframes glowPulse {
          0%,100% { box-shadow:0 0 32px rgba(114,85,224,0.45); }
          50%     { box-shadow:0 0 64px rgba(167,139,250,0.75), 0 0 0 18px rgba(167,139,250,0.06); }
        }

        @keyframes letterIn {
          from { opacity:0; transform:translateY(22px) scale(0.7); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }

        @keyframes pill1In {
          from { opacity:0; transform:translateX(-90px) rotate(-8deg); }
          to   { opacity:1; transform:translateX(0)    rotate(-8deg); }
        }
        @keyframes pill2In {
          from { opacity:0; transform:translateX(90px) rotate(6deg); }
          to   { opacity:1; transform:translateX(0)   rotate(6deg); }
        }
        @keyframes pill3In {
          from { opacity:0; transform:translate(-80px,24px) rotate(-5deg); }
          to   { opacity:1; transform:translate(0,0)        rotate(-5deg); }
        }
        @keyframes pill4In {
          from { opacity:0; transform:translate(80px,24px) rotate(7deg); }
          to   { opacity:1; transform:translate(0,0)       rotate(7deg); }
        }

        @keyframes pillFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }

        @keyframes sparkle {
          0%   { opacity:0; transform:scale(0) rotate(0deg); }
          35%  { opacity:1; transform:scale(1.3) rotate(160deg); }
          65%  { opacity:0.7; transform:scale(0.85) rotate(230deg); }
          100% { opacity:0; transform:scale(0) rotate(360deg); }
        }

        @keyframes progressFill {
          from { width:0%; }
          to   { width:100%; }
        }
      `}</style>

      {/* ── Background blobs ── */}
      <div style={{ position:'absolute', top:-150, right:-120, width:440, height:440, borderRadius:'50%',
        background:'radial-gradient(circle,rgba(139,92,246,0.42) 0%,transparent 65%)',
        animation:'blob1 7s ease-in-out infinite' }} />
      <div style={{ position:'absolute', bottom:-100, left:-110, width:380, height:380, borderRadius:'50%',
        background:'radial-gradient(circle,rgba(167,139,250,0.28) 0%,transparent 65%)',
        animation:'blob2 8.5s ease-in-out infinite' }} />
      <div style={{ position:'absolute', top:'48%', left:'52%', width:260, height:260, borderRadius:'50%',
        background:'radial-gradient(circle,rgba(99,102,241,0.22) 0%,transparent 65%)',
        animation:'blob3 6s ease-in-out infinite' }} />

      {/* ── Expanding rings ── */}
      {[0.3, 0.9, 1.5].map((d, i) => (
        <div key={i} style={{
          position:'absolute', width:180, height:180, borderRadius:'50%',
          border:'1.5px solid rgba(167,139,250,0.22)',
          animation:`ringOut 2.2s ${d}s ease-out infinite`,
        }} />
      ))}

      {/* ── Sparkle particles ── */}
      {SPARKLES.map((s, i) => (
        <div key={i} style={{
          position:'absolute', ...s,
          width: s.size, height: s.size,
          borderRadius:'50%',
          background:'rgba(255,255,255,0.85)',
          boxShadow:`0 0 ${s.size * 2.5}px rgba(196,181,253,0.9)`,
          animation:`sparkle 2.4s ${s.delay} ease-in-out infinite`,
        } as React.CSSProperties} />
      ))}

      {/* ── Task pills ── */}
      <div style={{ position:'absolute', top:'14%', left:'3%', animation:'pill1In 0.6s 0.55s cubic-bezier(0.22,1,0.36,1) both' }}>
        <div style={{ animation:'pillFloat 3.2s 1.3s ease-in-out infinite' }}>
          <PillCard label="Exercitar" sub="Seg · Ter · Qui" color="#a78bfa" />
        </div>
      </div>
      <div style={{ position:'absolute', top:'18%', right:'3%', animation:'pill2In 0.6s 0.72s cubic-bezier(0.22,1,0.36,1) both' }}>
        <div style={{ animation:'pillFloat 3.8s 1.5s ease-in-out infinite' }}>
          <PillCard label="Estudar" sub="Toda semana" color="#60a5fa" />
        </div>
      </div>
      <div style={{ position:'absolute', bottom:'24%', left:'2%', animation:'pill3In 0.6s 0.88s cubic-bezier(0.22,1,0.36,1) both' }}>
        <div style={{ animation:'pillFloat 2.9s 1.7s ease-in-out infinite' }}>
          <PillCard label="Reunião" sub="Hoje · 14h" color="#f43f5e" />
        </div>
      </div>
      <div style={{ position:'absolute', bottom:'21%', right:'2%', animation:'pill4In 0.6s 1.05s cubic-bezier(0.22,1,0.36,1) both' }}>
        <div style={{ animation:'pillFloat 3.5s 1.9s ease-in-out infinite' }}>
          <PillCard label="Academia" sub="Sáb · Dom" color="#34d399" />
        </div>
      </div>

      {/* ── Center: logo + text ── */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', zIndex:2, gap:0 }}>
        {/* Logo */}
        <div style={{
          width: 96, height: 96, borderRadius: 26,
          overflow: 'hidden', flexShrink: 0,
          animation: 'logoBounce 0.85s 0.2s cubic-bezier(0.22,1,0.36,1) both, glowPulse 2.8s 1.2s ease-in-out infinite',
        }}>
          <img
            src="/weekly-512.png"
            alt="Rotina"
            style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
          />
        </div>

        {/* "Rotina" com letras entrando */}
        <div style={{
          display: 'flex', gap: 0, marginTop: 22,
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '2.6rem', fontWeight: 800,
          letterSpacing: '-0.045em', color: 'white',
        }}>
          {'Rotina'.split('').map((ch, i) => (
            <span key={i} style={{
              display: 'inline-block',
              animation: `letterIn 0.45s ${0.52 + i * 0.065}s cubic-bezier(0.22,1,0.36,1) both`,
            }}>
              {ch}
            </span>
          ))}
        </div>

        {/* Subtitle */}
        <div style={{
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '0.82rem', fontWeight: 400,
          color: 'rgba(255,255,255,0.48)',
          letterSpacing: '0.11em', textTransform: 'uppercase',
          marginTop: 7,
          animation: 'fadeUp 0.5s 1.05s ease both',
        }}>
          Weekly Planner
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div style={{
        position: 'absolute', bottom: 54,
        width: 110, height: 2.5,
        background: 'rgba(255,255,255,0.10)',
        borderRadius: 99, overflow: 'hidden',
        animation: 'fadeUp 0.3s 1.15s ease both',
      }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg, rgba(167,139,250,0.65), rgba(255,255,255,0.9))',
          borderRadius: 99,
          animation: 'progressFill 1.5s 1.15s cubic-bezier(0.4,0,0.2,1) both',
        }} />
      </div>
    </div>
  );
}
