import { useEffect } from 'react';

export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options?: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean }
): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const keyMatches = e.key.toLowerCase() === key.toLowerCase();
      const ctrlMatches = options?.ctrl ? (e.ctrlKey || e.metaKey) : true;
      const metaMatches = options?.meta ? e.metaKey : true;
      const shiftMatches = options?.shift ? e.shiftKey : true;
      const altMatches = options?.alt ? e.altKey : true;

      if (keyMatches && ctrlMatches && metaMatches && shiftMatches && altMatches) {
        e.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, callback, options]);
}

export function useEscapeKey(callback: () => void): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') callback();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [callback]);
}
