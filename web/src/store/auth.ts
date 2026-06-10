import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type User = { id: string; name: string; email: string };

type AuthStore = {
  user: User | null;
  token: string | null;
  setSession: (user: User, token: string) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setSession: (user, token) => set({ user, token }),
      clearSession: () => set({ user: null, token: null }),
    }),
    { name: 'rotina-auth' },
  ),
);
