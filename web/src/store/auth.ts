import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type User = { id: string; name: string; email: string };

type AuthStore = {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  setSession: (user: User, token: string, refreshToken?: string) => void;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      setSession: (user, token, refreshToken) => set({ user, token, refreshToken: refreshToken ?? null }),
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      clearSession: () => set({ user: null, token: null, refreshToken: null }),
    }),
    { name: 'rotina-auth' },
  ),
);
