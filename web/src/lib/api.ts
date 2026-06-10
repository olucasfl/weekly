const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333';

let _getToken: (() => string | null) | null = null;
let _getRefreshToken: (() => string | null) | null = null;
let _setToken: ((token: string) => void) | null = null;
let _onUnauthorized: (() => void) | null = null;

let _refreshing: Promise<string | null> | null = null;

export function configureApi(
  getToken: () => string | null,
  onUnauthorized: () => void,
  getRefreshToken: () => string | null,
  setToken: (token: string) => void,
) {
  _getToken = getToken;
  _onUnauthorized = onUnauthorized;
  _getRefreshToken = getRefreshToken;
  _setToken = setToken;
}

async function tryRefresh(): Promise<string | null> {
  if (_refreshing) return _refreshing;
  _refreshing = (async () => {
    const refreshToken = _getRefreshToken?.();
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const data = await res.json() as { accessToken: string };
      _setToken?.(data.accessToken);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      _refreshing = null;
    }
  })();
  return _refreshing;
}

function buildHeaders(token: string | null, init?: RequestInit) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers ?? {}),
  };
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = _getToken?.() ?? null;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: buildHeaders(token, init),
  });

  if (res.status === 401 && !path.startsWith('/auth/')) {
    const newToken = await tryRefresh();
    if (newToken) {
      const retry = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: buildHeaders(newToken, init),
      });
      if (retry.status === 401) {
        _onUnauthorized?.();
        throw new Error('Sessão expirada');
      }
      if (!retry.ok) {
        const body = await retry.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? 'Erro na requisição');
      }
      const text = await retry.text();
      return (text ? JSON.parse(text) : undefined) as T;
    }
    _onUnauthorized?.();
    throw new Error('Sessão expirada');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? 'Erro na requisição');
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
