import { useEffect, useRef } from 'react';

/** Keeps the screen awake while `active` is true. Silently no-ops where the
 *  Wake Lock API isn't available (unsupported browser, denied, etc). */
export function useWakeLock(active: boolean) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let cancelled = false;

    async function acquire() {
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
      } catch {
        // ignore — e.g. no user gesture yet, battery saver, unsupported
      }
    }

    acquire();

    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && !sentinelRef.current) acquire();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
    };
  }, [active]);
}
