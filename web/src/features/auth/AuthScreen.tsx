import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail } from 'lucide-react';
import { LogoWordmark } from '../../components/Logo';
import { api } from '../../lib/api';
import { useAuthStore, type User } from '../../store/auth';

type Mode = 'login' | 'register';

function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="auth-pw-wrap">
      <input
        className="input auth-pw-input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="auth-pw-eye"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
      >
        {show ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
      </button>
    </div>
  );
}

export function AuthScreen() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false); // tela pós-cadastro
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setEmailNotVerified(false);

    if (mode === 'register' && password !== confirm) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        await api<{ id: string }>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password }),
        });
        setRegistered(true);
        return;
      }

      const result = await api<{ user: User; accessToken: string; refreshToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setSession(result.user, result.accessToken, result.refreshToken);
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado';
      if (msg === 'EMAIL_NOT_VERIFIED') {
        setEmailNotVerified(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendLoading(true);
    try {
      await api('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) });
      setResendDone(true);
    } finally {
      setResendLoading(false);
    }
  }

  function switchMode(m: Mode) {
    setMode(m);
    setError('');
    setConfirm('');
    setEmailNotVerified(false);
    setResendDone(false);
  }

  // ── Tela pós-cadastro ─────────────────────────────────────────
  if (registered) {
    return (
      <div className="auth-root">
        <div className="auth-blob auth-blob-1" />
        <div className="auth-blob auth-blob-2" />
        <div className="auth-content">
          <div className="auth-brand">
            <div className="auth-icon-wrap">
              <img src="/weekly-192.png" alt="Weekly" className="auth-icon-img" />
            </div>
            <LogoWordmark size="lg" />
          </div>
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <Mail size={48} strokeWidth={1.5} color="var(--brand)" style={{ margin: '0 auto 16px' }} />
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: 8 }}>Verifique seu email!</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: 24 }}>
              Enviamos um link de confirmação para<br />
              <strong style={{ color: 'var(--text-primary)' }}>{email}</strong><br />
              Clique no link para ativar sua conta.
            </p>
            <button className="btn btn-primary auth-submit" onClick={() => setRegistered(false)}>
              Ir para o login
            </button>
          </div>
          <p className="auth-footer">Verifique também a caixa de spam</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-root">
      <div className="auth-blob auth-blob-1" />
      <div className="auth-blob auth-blob-2" />
      <div className="auth-blob auth-blob-3" />

      <div className="auth-content">
        {/* ── Brand ─────────────────────────────────────────── */}
        <div className="auth-brand">
          <div className="auth-icon-wrap">
            <img src="/weekly-192.png" alt="Weekly" className="auth-icon-img" />
          </div>
          <LogoWordmark size="lg" />
          <p className="auth-tagline">Organize sua semana com calma</p>
        </div>

        {/* ── Card ──────────────────────────────────────────── */}
        <div className="auth-card">
          <div className="auth-tabs">
            {(['login', 'register'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`auth-tab${mode === m ? ' active' : ''}`}
              >
                {m === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          {/* Email não verificado */}
          {emailNotVerified && (
            <div style={{ background: 'var(--warning-bg)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--warning)', marginBottom: 4 }}>Email não verificado</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                Confirme seu email antes de fazer login. Não recebeu?
              </div>
              {resendDone ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>✓ Email reenviado!</div>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading}
                  style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {resendLoading ? 'Enviando…' : 'Reenviar email de verificação'}
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'register' && (
              <div className="field">
                <label className="label">Nome</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  required
                  autoComplete="name"
                />
              </div>
            )}

            <div className="field">
              <label className="label">E-mail</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="field">
              <label className="label">Senha</label>
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </div>

            {mode === 'register' && (
              <div className="field">
                <label className="label">Confirmar senha</label>
                <PasswordInput
                  value={confirm}
                  onChange={setConfirm}
                  placeholder="Repita a senha"
                  autoComplete="new-password"
                  required
                />
              </div>
            )}

            {error && <div className="error-msg">{error}</div>}

            <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
              {loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>

            {mode === 'login' && (
              <button
                type="button"
                onClick={() => navigate('/esqueci-senha')}
                style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', textAlign: 'center', padding: '4px 0' }}
              >
                Esqueci minha senha
              </button>
            )}
          </form>
        </div>

        <p className="auth-footer">Seus dados são sincronizados com segurança na nuvem</p>
      </div>
    </div>
  );
}
