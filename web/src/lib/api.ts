const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333';

let _getToken: (() => string | null) | null = null;
let _onUnauthorized: (() => void) | null = null;

export function configureApi(getToken: () => string | null, onUnauthorized: () => void) {
  _getToken = getToken;
  _onUnauthorized = onUnauthorized;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = _getToken?.();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401) {
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
