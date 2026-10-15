import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'free-muscle.theme';

/** Colours the 3D scene needs per theme (the rest of the UI uses CSS variables). */
export const SCENE_COLORS: Record<Theme, { background: string; ground: string }> = {
  dark: { background: '#14161c', ground: '#30343f' },
  light: { background: '#e9ecf1', ground: '#b9bfca' },
};

/**
 * Current theme and a toggle. Starts from <html data-theme> (set before first paint in index.html):
 * the saved choice, else dark.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', SCENE_COLORS[theme].background);
  }, [theme]);

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
