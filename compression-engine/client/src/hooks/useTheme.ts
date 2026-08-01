/**
 * useTheme
 *
 * Applies the current theme from the UI store to the <html> element as a class,
 * so CSS variables defined in index.css can be swapped on the fly.
 *
 * Also syncs the browser's meta theme-color for mobile chrome.
 */

import { useEffect } from 'react';
import { useUiStore } from '../store';

export function useTheme(): 'dark' | 'light' {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);

    // Update meta theme-color for mobile browser chrome
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = theme === 'dark' ? '#0f1218' : '#ffffff';
  }, [theme]);

  return theme;
}
