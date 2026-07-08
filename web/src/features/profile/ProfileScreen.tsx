import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Bell, BellOff, LogOut, Smartphone, Info, Moon, Sun, Pencil, Key, Trash2, X, Check, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import { BottomNav } from '../../components/BottomNav';
import { LogoMark } from '../../components/Logo';
import { useAuthStore } from '../../store/auth';
import { useThemeStore } from '../../store/theme';
import { api } from '../../lib/api';

type ProfileData = { id: string; name: string; email: string; pendingEmail: string | null };

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

// ─── EditProfileModal ───────────────────────────────────────────
function EditProfileModal({ profile, onClose, onSaved }: { profile: ProfileData; onClose: () => void; onSaved: () => void }) {
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailPending, setEmailPending] = useState(false);

  const emailChanged = email.trim() !== profile.email;

  async function submit() {
    if (!name.trim()) { setError('Informe o nome'); return; }
    if (!email.trim()) { setError('Informe o email'); return; }
    setLoading(true); setError('');
    try {
      const updated = await api<{ id: string; name: string; email: string; pendingEmail: string | null; emailChangePending: boolean }>('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      setUser({ id: updated.id, name: updated.name, email: updated.email });
      if (updated.emailChangePending) {
        setEmailPending(true);
      } else {
        onSaved();
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  }

  if (emailPending) {
    return (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal">
          <div className="modal-handle" />
          <div className="modal-header">
            <span className="modal-title">Verificação enviada</span>
            <button className="modal-close" onClick={() => { onSaved(); onClose(); }}><X size={18} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center', padding: '8px 0' }}>
            <Clock size={40} strokeWidth={1.5} color="var(--brand)" />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>
              Enviamos um link de confirmação para <strong>{email.trim()}</strong>.<br />
              Clique no link para concluir a troca. Enquanto isso, seu email atual continua ativo.
            </p>
          </div>
          <div className="modal-actions">
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { onSaved(); onClose(); }}>Entendido</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-header">
          <span className="modal-title">Editar perfil</span>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label className="label">Nome</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
          </div>
          <div className="field">
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
            {emailChanged && (
              <div style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: 4, display: 'flex', gap: 5, alignItems: 'center' }}>
                <AlertCircle size={12} />
                Um link de verificação será enviado para o novo email
              </div>
            )}
          </div>
        </div>
        {error && <div className="error-msg" style={{ marginTop: 12 }}>{error}</div>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ChangePasswordModal ────────────────────────────────────────
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function submit() {
    if (!current) { setError('Informe a senha atual'); return; }
    if (next.length < 6) { setError('Nova senha deve ter ao menos 6 caracteres'); return; }
    if (next !== confirm) { setError('As senhas não coincidem'); return; }
    setLoading(true); setError('');
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  }

  async function sendForgotPassword() {
    if (!user?.email) return;
    setLoading(true); setError('');
    try {
      await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: user.email }) });
      setResetSent(true);
    } catch {
      setResetSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-header">
          <span className="modal-title">Alterar senha</span>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        {success ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--success)', padding: '12px 0' }}>
            <Check size={18} />
            <span>Senha alterada com sucesso!</span>
          </div>
        ) : resetSent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', textAlign: 'center', padding: '8px 0' }}>
            <Check size={36} strokeWidth={1.5} color="var(--success)" />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>
              Enviamos um link de redefinição para <strong>{user?.email}</strong>.<br />Verifique sua caixa de entrada.
            </p>
            <button className="btn btn-primary" style={{ marginTop: 4 }} onClick={onClose}>Fechar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field">
              <label className="label">Senha atual</label>
              <input className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="••••••" />
            </div>
            <div className="field">
              <label className="label">Nova senha</label>
              <input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="field">
              <label className="label">Confirmar nova senha</label>
              <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repita a nova senha" />
            </div>
            <button
              type="button"
              onClick={sendForgotPassword}
              disabled={loading}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand)', fontSize: '0.82rem', textAlign: 'left', padding: 0, fontFamily: 'var(--font)' }}
            >
              Esqueci minha senha atual
            </button>
          </div>
        )}
        {error && <div className="error-msg" style={{ marginTop: 12 }}>{error}</div>}
        {!success && !resetSent && (
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={submit} disabled={loading}>
              {loading ? 'Salvando…' : 'Alterar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DeleteAccountModal ─────────────────────────────────────────
function DeleteAccountModal({ onClose, onDeleted }: { onClose: () => void; onDeleted: () => void }) {
  const user = useAuthStore((s) => s.user);
  const [typed, setTyped] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const confirmPhrase = user?.email ?? '';
  const isConfirmed = typed === confirmPhrase;

  async function submit() {
    if (!isConfirmed) return;
    setLoading(true); setError('');
    try {
      await api('/auth/account', { method: 'DELETE' });
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir conta');
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-header">
          <span className="modal-title" style={{ color: 'var(--danger)' }}>Excluir conta</span>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'var(--danger-bg)', borderRadius: 'var(--r-md)', padding: '12px 14px', fontSize: '0.85rem', color: 'var(--danger)' }}>
            <strong>Atenção:</strong> esta ação é irreversível. Todos os seus dados (tarefas, eventos, histórico, categorias) serão excluídos permanentemente.
          </div>
          <div className="field">
            <label className="label">Para confirmar, digite seu email: <strong>{confirmPhrase}</strong></label>
            <input
              className="input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmPhrase}
              style={{ borderColor: typed && !isConfirmed ? 'var(--danger)' : undefined }}
            />
          </div>
        </div>
        {error && <div className="error-msg" style={{ marginTop: 12 }}>{error}</div>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-danger" onClick={submit} disabled={!isConfirmed || loading}>
            {loading ? 'Excluindo…' : 'Excluir conta'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ProfileScreen ──────────────────────────────────────────────
export function ProfileScreen() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const { dark, toggle: toggleTheme } = useThemeStore();
  const qc = useQueryClient();

  const [modal, setModal] = useState<'edit' | 'password' | 'delete' | null>(null);

  const { data: profile } = useQuery<ProfileData>({
    queryKey: ['profile'],
    queryFn: () => api('/auth/me'),
    staleTime: 30_000,
  });

  const cancelEmailChangeMutation = useMutation({
    mutationFn: () => api('/auth/cancel-email-change', { method: 'POST', body: '{}' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });

  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const [weekStartsSunday, setWeekStartsSunday] = useState(
    () => localStorage.getItem('weekStartsSunday') === '1'
  );

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => setPushEnabled(!!sub));
      }).catch(() => {});
    }
  }, []);

  function toggleWeekStart(val: boolean) {
    setWeekStartsSunday(val);
    localStorage.setItem('weekStartsSunday', val ? '1' : '0');
  }

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
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
        await api('/push/subscribe', {
          method: 'POST',
          body: JSON.stringify({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, timezone }),
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

  function handleDeleted() {
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
        {/* Avatar + user info + edit */}
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
          <button
            className="btn btn-ghost"
            style={{ padding: '8px 12px', gap: 6, fontSize: '0.8rem' }}
            onClick={() => setModal('edit')}
          >
            <Pencil size={13} strokeWidth={2} />
            Editar
          </button>
        </div>

        {/* Pending email change banner */}
        {profile?.pendingEmail && (
          <div style={{ background: 'var(--warning-bg)', borderRadius: 'var(--r-md)', padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Clock size={15} strokeWidth={2} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--warning)', marginBottom: 2 }}>Troca de email pendente</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Aguardando verificação de <strong>{profile.pendingEmail}</strong>. Verifique sua caixa de entrada.
              </div>
            </div>
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warning)', padding: 2, flexShrink: 0 }}
              onClick={() => cancelEmailChangeMutation.mutate()}
              title="Cancelar troca"
              disabled={cancelEmailChangeMutation.isPending}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Account actions */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <button
            className="profile-action-row"
            onClick={() => setModal('password')}
          >
            <div className="row" style={{ gap: 10 }}>
              <Key size={15} strokeWidth={2} color="var(--brand)" />
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Alterar senha</span>
            </div>
            <ChevronRight size={15} color="var(--text-muted)" />
          </button>
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

        {/* Calendar preferences */}
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 14 }}>Calendário</div>
          <div className="toggle-row">
            <div>
              <div className="toggle-label">Semana começa no domingo</div>
              <div className="toggle-desc">{weekStartsSunday ? 'Dom → Sáb' : 'Seg → Dom'}</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={weekStartsSunday} onChange={(e) => toggleWeekStart(e.target.checked)} />
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

        {/* Delete account */}
        <button
          className="btn btn-ghost"
          onClick={() => setModal('delete')}
          style={{ width: '100%', color: 'var(--text-muted)', gap: 8, fontSize: '0.8rem' }}
        >
          <Trash2 size={14} strokeWidth={2} />
          Excluir conta
        </button>
      </div>

      {modal === 'edit' && profile && (
        <EditProfileModal
          profile={profile}
          onClose={() => setModal(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['profile'] })}
        />
      )}
      {modal === 'password' && <ChangePasswordModal onClose={() => setModal(null)} />}
      {modal === 'delete' && <DeleteAccountModal onClose={() => setModal(null)} onDeleted={handleDeleted} />}

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
