import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeStore = { dark: boolean; toggle: () => void };

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      dark: false,
      toggle: () => set((s) => {
        const next = !s.dark;
        document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
        return { dark: next };
      }),
    }),
    { name: 'rotina-theme' },
  ),
);

export function initTheme() {
  try {
    const raw = localStorage.getItem('rotina-theme');
    if (raw && JSON.parse(raw)?.state?.dark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch {}
}
