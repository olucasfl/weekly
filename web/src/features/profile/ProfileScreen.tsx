import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Bell, BellOff, LogOut, Smartphone, Info, Moon, Sun } from 'lucide-react';
import { BottomNav } from '../../components/BottomNav';
import { LogoMark } from '../../components/Logo';
import { useAuthStore } from '../../store/auth';
import { useThemeStore } from '../../store/theme';
import { api } from '../../lib/api';

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

export function ProfileScreen() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const { dark, toggle: toggleTheme } = useThemeStore();

  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => setPushEnabled(!!sub));
      }).catch(() => {});
    }
  }, []);

  async function togglePush() {
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (pushEnabled) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await api('/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint: sub.endpoint }) });
        }
        setPushEnabled(false);
      } else {
        const { publicKey } = await api<{ publicKey: string }>('/push/public-key');
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        const json = sub.toJSON();
        await api('/push/subscribe', {
          method: 'POST',
          body: JSON.stringify({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth }),
        });
        setPushEnabled(true);
      }
    } catch (err) {
      console.error('Push toggle error:', err);
    } finally {
      setPushLoading(false);
    }
  }

  function handleLogout() {
    clearSession();
    navigate('/auth');
  }

  return (
    <>
      <div className="screen-header">
        <div className="screen-title">Perfil</div>
        <div className="screen-subtitle">Conta e configurações</div>
      </div>

      <div className="screen-body">
        {/* Avatar + user info */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {user?.name
              ? <span style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>{getInitials(user.name)}</span>
              : <User size={22} color="white" strokeWidth={2} />
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{user?.name ?? 'Usuário'}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user?.email ?? ''}</div>
          </div>
        </div>

        {/* Dark mode */}
        <div className="card">
          <div className="toggle-row">
            <div>
              <div className="row" style={{ gap: 8, marginBottom: 2 }}>
                {dark ? <Moon size={15} strokeWidth={2} color="var(--brand)" /> : <Sun size={15} strokeWidth={2} color="var(--brand)" />}
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Modo escuro</span>
              </div>
              <div className="toggle-desc">{dark ? 'Tema escuro ativo' : 'Tema claro ativo'}</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={dark} onChange={toggleTheme} />
              <div className="toggle-track" />
            </label>
          </div>
        </div>

        {/* Notifications */}
        {pushSupported ? (
          <div className="card">
            <div className="row" style={{ gap: 8, marginBottom: 4 }}>
              <Bell size={15} strokeWidth={2} color="var(--brand)" />
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Notificações</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 14 }}>
              Receba lembretes no horário das suas tarefas.
              {' '}<strong>iOS:</strong> instale o app na tela de início primeiro.
            </p>
            <div className="toggle-row">
              <div>
                <div className="toggle-label">Lembretes push</div>
                <div className="toggle-desc">{pushEnabled ? 'Ativo — você receberá notificações' : 'Desativado'}</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={pushEnabled} disabled={pushLoading} onChange={togglePush} />
                <div className="toggle-track" />
              </label>
            </div>
          </div>
        ) : (
          <div className="card-ghost">
            <div className="row" style={{ gap: 8, marginBottom: 6 }}>
              <Smartphone size={15} strokeWidth={2} color="var(--text-muted)" />
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Notificações</span>
            </div>
            <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
              <BellOff size={14} strokeWidth={1.8} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Não disponível neste navegador. No <strong>iPhone</strong>, adicione à tela de início
                via Safari → Compartilhar → Adicionar à Tela de Início.
              </p>
            </div>
          </div>
        )}

        {/* App info */}
        <div className="card-ghost">
          <div className="row" style={{ gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--brand-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <LogoMark size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Weekly</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Planejador Semanal</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="row-between">
              <div className="row" style={{ gap: 6 }}>
                <Info size={13} strokeWidth={2} color="var(--text-muted)" />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Versão</span>
              </div>
              <span className="pill pill-sm pill-neutral">1.0.0</span>
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          className="btn btn-ghost"
          onClick={handleLogout}
          style={{ width: '100%', color: 'var(--danger)', borderColor: 'rgba(220,38,38,0.2)', gap: 8 }}
        >
          <LogOut size={15} strokeWidth={2} />
          Sair da conta
        </button>
      </div>

      <BottomNav />
    </>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
