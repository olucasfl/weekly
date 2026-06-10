import { useRef, useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineBanner() {
  const online = useOnlineStatus();
  const [reconnected, setReconnected] = useState(false);
  const prev = useRef(online);

  useEffect(() => {
    if (!prev.current && online) {
      setReconnected(true);
      const t = setTimeout(() => setReconnected(false), 3000);
      prev.current = online;
      return () => clearTimeout(t);
    }
    prev.current = online;
  }, [online]);

  const visible = !online || reconnected;
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        zIndex: 10000,
        background: online ? '#16a34a' : '#111827',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '10px 16px',
        fontSize: '0.82rem',
        fontWeight: 600,
        letterSpacing: '0.01em',
        boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
        transition: 'background 0.3s',
      }}
    >
      {online
        ? <><Wifi size={14} /> Conexão restaurada · Atualizando…</>
        : <><WifiOff size={14} /> Você está offline · Exibindo dados em cache</>
      }
    </div>
  );
}
