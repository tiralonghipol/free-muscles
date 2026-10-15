import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'free-muscle.theme';
const system = (): Theme => (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

function saved(): Theme | null {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

/** Colours the 3D scene needs per theme (the rest of the UI uses CSS variables). */
export const SCENE_COLORS: Record<Theme, { background: string; ground: string }> = {
  dark: { background: '#14161c', ground: '#30343f' },
  light: { background: '#e9ecf1', ground: '#b9bfca' },
};

/**
 * Current theme and a toggle. Starts from <html data-theme> (set before first paint in index.html):
 * the saved choice, else the system setting, which keeps being followed until the user picks one.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme) || system());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', SCENE_COLORS[theme].background);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    const follow = () => { if (!saved()) setTheme(system()); };
    mq?.addEventListener('change', follow);
    return () => mq?.removeEventListener('change', follow);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private mode etc.: the choice just isn't remembered.
    }
    setTheme(next);
  };

  return { theme, toggle };
}
