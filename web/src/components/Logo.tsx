type LogoMarkProps = {
  size?: number;
};

/** Ícone SVG da marca Weekly — grade semanal com check */
export function LogoMark({ size = 32 }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Weekly"
    >
      {/* Dot grid — 7 colunas representando dias da semana */}
      {[0, 1, 2, 3, 4, 5, 6].map((col) => (
        <rect
          key={`top-${col}`}
          x={5 + col * 4.5}
          y={7}
          width={2.8}
          height={2.8}
          rx={1.4}
          fill="white"
          opacity={col < 5 ? 0.9 : 0.35}
        />
      ))}
      {[0, 1, 2, 3, 4, 5, 6].map((col) => (
        <rect
          key={`mid-${col}`}
          x={5 + col * 4.5}
          y={13}
          width={2.8}
          height={2.8}
          rx={1.4}
          fill="white"
          opacity={col < 3 ? 0.9 : 0.35}
        />
      ))}

      {/* Check mark na parte inferior */}
      <circle cx={20} cy={28} r={8} fill="white" opacity={0.15} />
      <path
        d="M15.5 28.2l3.2 3.2 5.8-6.4"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Versão do logo para usar inline (nav, etc) — usa currentColor */
export function LogoMarkIcon({ size = 20 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Weekly"
    >
      {[0, 1, 2, 3, 4, 5, 6].map((col) => (
        <rect key={`top-${col}`} x={5 + col * 4.5} y={7} width={2.8} height={2.8} rx={1.4}
          fill="currentColor" opacity={col < 5 ? 1 : 0.4} />
      ))}
      {[0, 1, 2, 3, 4, 5, 6].map((col) => (
        <rect key={`mid-${col}`} x={5 + col * 4.5} y={13} width={2.8} height={2.8} rx={1.4}
          fill="currentColor" opacity={col < 3 ? 1 : 0.4} />
      ))}
      <circle cx={20} cy={28} r={8} fill="currentColor" opacity={0.12} />
      <path d="M15.5 28.2l3.2 3.2 5.8-6.4" stroke="currentColor" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type LogoWordmarkProps = {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
};

/** Wordmark "Weekly" com tipografia personalizada */
export function LogoWordmark({ size = 'md', color = 'var(--text-primary)' }: LogoWordmarkProps) {
  const sizes = { sm: '1rem', md: '1.35rem', lg: '1.8rem' };
  return (
    <span style={{
      fontFamily: 'var(--font)',
      fontSize: sizes[size],
      fontWeight: 800,
      letterSpacing: '-0.035em',
      color,
      lineHeight: 1,
    }}>
      Weekly
    </span>
  );
}

type LogoFullProps = {
  iconSize?: number;
  textSize?: 'sm' | 'md' | 'lg';
  direction?: 'row' | 'col';
};

/** Logo completo: ícone + wordmark */
export function LogoFull({ iconSize = 36, textSize = 'md', direction = 'row' }: LogoFullProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: direction === 'col' ? 'column' : 'row',
      alignItems: 'center',
      gap: direction === 'col' ? 10 : 10,
    }}>
      <div style={{
        width: iconSize + 12,
        height: iconSize + 12,
        borderRadius: Math.round((iconSize + 12) * 0.28),
        background: 'var(--brand-grad)',
        boxShadow: 'var(--shadow-brand)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <LogoMark size={iconSize} />
      </div>
      <LogoWordmark size={textSize} />
    </div>
  );
}
