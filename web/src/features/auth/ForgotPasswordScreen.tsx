import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { LogoWordmark } from '../../components/Logo';
import { api } from '../../lib/api';

export function ForgotPasswordScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

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

        <div className="auth-card">
          <button
            type="button"
            onClick={() => navigate('/auth')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', marginBottom: 20, padding: 0 }}
          >
            <ArrowLeft size={15} strokeWidth={2} /> Voltar
          </button>

          {sent ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <Mail size={44} strokeWidth={1.5} color="var(--brand)" style={{ margin: '0 auto 16px' }} />
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: 8 }}>Email enviado!</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>
                Se <strong>{email}</strong> estiver cadastrado, você receberá um link para redefinir a senha.<br />
                Verifique a caixa de entrada e spam.
              </p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: 6 }}>Esqueceu a senha?</div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0, lineHeight: 1.5 }}>
                  Digite seu email e enviaremos um link para redefinir sua senha.
                </p>
              </div>
              <form onSubmit={handleSubmit} className="auth-form">
                <div className="field">
                  <label className="label">E-mail</label>
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    autoFocus
                  />
                </div>
                {error && <div className="error-msg">{error}</div>}
                <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
                  {loading ? 'Enviando…' : 'Enviar link'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="auth-footer">O link expira em 1 hora</p>
      </div>
    </div>
  );
}
