import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { LogoWordmark } from '../../components/Logo';
import { api } from '../../lib/api';
import { Eye, EyeOff } from 'lucide-react';

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="auth-pw-wrap">
      <input
        className="input auth-pw-input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        autoComplete="new-password"
      />
      <button type="button" className="auth-pw-eye" onClick={() => setShow((s) => !s)} tabIndex={-1}>
        {show ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
      </button>
    </div>
  );
}

export function ResetPasswordScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('As senhas não coincidem'); return; }
    if (password.length < 6) { setError('Mínimo 6 caracteres'); return; }
    setError('');
    setLoading(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-root">
        <div className="auth-content" style={{ textAlign: 'center' }}>
          <div className="auth-card">
            <p style={{ color: 'var(--danger)', fontWeight: 600 }}>Link inválido.</p>
            <button className="btn btn-primary auth-submit" style={{ marginTop: 16 }} onClick={() => navigate('/auth')}>Voltar</button>
          </div>
        </div>
      </div>
    );
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
          {done ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <CheckCircle size={48} strokeWidth={1.5} color="#059669" style={{ margin: '0 auto 16px' }} />
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: 8 }}>Senha redefinida!</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 24 }}>Sua senha foi atualizada com sucesso.</p>
              <button className="btn btn-primary auth-submit" onClick={() => navigate('/auth')}>Ir para o login</button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: 6 }}>Nova senha</div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Escolha uma senha segura para sua conta.</p>
              </div>
              <form onSubmit={handleSubmit} className="auth-form">
                <div className="field">
                  <label className="label">Nova senha</label>
                  <PasswordInput value={password} onChange={setPassword} placeholder="Mínimo 6 caracteres" />
                </div>
                <div className="field">
                  <label className="label">Confirmar senha</label>
                  <PasswordInput value={confirm} onChange={setConfirm} placeholder="Repita a senha" />
                </div>
                {error && <div className="error-msg">{error}</div>}
                <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
                  {loading ? 'Salvando…' : 'Salvar nova senha'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
