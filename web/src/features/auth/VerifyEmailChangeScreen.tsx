import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth';

export function VerifyEmailChangeScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const user = useAuthStore((s) => s.user);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setError('Link inválido'); return; }
    api('/auth/verify-email-change?token=' + token)
      .then(() => setStatus('success'))
      .catch((e) => { setStatus('error'); setError(e instanceof Error ? e.message : 'Erro'); });
  }, [token]);

  return (
    <div className="auth-root">
      <div className="auth-blob auth-blob-1" />
      <div className="auth-blob auth-blob-2" />
      <div className="auth-content" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="auth-card" style={{ maxWidth: 360, width: '100%' }}>
          {status === 'loading' && (
            <>
              <Loader size={44} strokeWidth={1.5} color="var(--brand)" style={{ margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Verificando…</div>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle size={48} strokeWidth={1.5} color="#059669" style={{ margin: '0 auto 16px' }} />
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: 8 }}>Email atualizado!</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 24 }}>
                Seu email foi atualizado com sucesso. Use o novo endereço para fazer login.
              </p>
              <button
                className="btn btn-primary auth-submit"
                onClick={() => navigate(user ? '/perfil' : '/auth')}
              >
                {user ? 'Ir para o perfil' : 'Ir para o login'}
              </button>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle size={48} strokeWidth={1.5} color="var(--danger)" style={{ margin: '0 auto 16px' }} />
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: 8 }}>Link inválido</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 24 }}>{error || 'Este link expirou ou já foi usado.'}</p>
              <button className="btn btn-primary auth-submit" onClick={() => navigate(user ? '/perfil' : '/auth')}>
                {user ? 'Voltar ao perfil' : 'Voltar ao login'}
              </button>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
