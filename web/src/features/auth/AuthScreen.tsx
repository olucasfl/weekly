import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoMark, LogoWordmark } from '../../components/Logo';
import { api } from '../../lib/api';
import { useAuthStore, type User } from '../../store/auth';

type Mode = 'login' | 'register';

export function AuthScreen() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        await api<{ id: string }>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password }),
        });
      }
      const result = await api<{ user: User; accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setSession(result.user, result.accessToken);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
      background: 'linear-gradient(160deg, #ede9ff 0%, #f7f6fc 45%, #eef5ff 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* decorative blobs */}
      <div style={{ position: 'absolute', top: '-80px', right: '-60px', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(114,85,224,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-60px', left: '-40px', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.10) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'var(--brand-grad)',
            margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(114,85,224,0.40)',
          }}>
            <LogoMark size={40} />
          </div>
          <LogoWordmark size="lg" />
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 6, fontWeight: 400 }}>
            Organize sua semana com calma
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(114,85,224,0.14)',
          borderRadius: 24,
          padding: '28px 24px',
          boxShadow: '0 8px 40px rgba(80,60,160,0.12), 0 1px 0 rgba(255,255,255,0.8) inset',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', background: 'var(--bg-surface-2)', borderRadius: 'var(--r-full)', padding: 3, marginBottom: 24 }}>
            {(['login', 'register'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(''); }}
                style={{
                  flex: 1, border: 'none',
                  borderRadius: 'var(--r-full)', padding: '8px',
                  fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: mode === m ? 'white' : 'transparent',
                  color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: mode === m ? 'var(--shadow-xs)' : 'none',
                }}
              >
                {m === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'register' && (
              <div className="field">
                <label className="label">Nome</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" required autoComplete="name" />
              </div>
            )}
            <div className="field">
              <label className="label">E-mail</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required autoComplete="email" />
            </div>
            <div className="field">
              <label className="label">Senha</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4, height: 44, fontSize: '0.925rem' }}>
              {loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 20 }}>
          Seus dados ficam apenas neste dispositivo
        </p>
      </div>
    </div>
  );
}
