export function Skeleton({ width, height, radius = 8, style }: {
  width?: string | number;
  height?: string | number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

export function TaskRowSkeleton() {
  return (
    <div className="task-row" style={{ pointerEvents: 'none', cursor: 'default', gap: 12 }}>
      <Skeleton width={24} height={24} radius={6} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton height={14} radius={6} style={{ width: '65%' }} />
        <Skeleton height={11} radius={5} style={{ width: '35%' }} />
      </div>
    </div>
  );
}

export function StatBoxSkeleton() {
  return (
    <div className="stat-box" style={{ gap: 8 }}>
      <Skeleton height={28} radius={6} style={{ width: '50%' }} />
      <Skeleton height={12} radius={5} style={{ width: '70%' }} />
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={14} radius={6} style={{ width: i === 0 ? '80%' : i === lines - 1 ? '45%' : '65%' }} />
      ))}
    </div>
  );
}
