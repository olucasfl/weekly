import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeStore = { dark: boolean; toggle: () => void };

// Mirrors --bg-base from index.css for each theme — keeps the OS status bar/task
// switcher in sync with the app background instead of always showing the light color.
const LIGHT_THEME_COLOR = '#f8f2ff';
const DARK_THEME_COLOR = '#0f0d1a';

function applyThemeColor(dark: boolean) {
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      dark: false,
      toggle: () => set((s) => {
        const next = !s.dark;
        document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
        applyThemeColor(next);
        return { dark: next };
      }),
    }),
    { name: 'rotina-theme' },
  ),
);

export function initTheme() {
  try {
    const raw = localStorage.getItem('rotina-theme');
    const dark = !!(raw && JSON.parse(raw)?.state?.dark);
    if (dark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    applyThemeColor(dark);
  } catch {}
}
