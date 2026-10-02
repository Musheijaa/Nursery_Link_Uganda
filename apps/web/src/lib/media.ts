import { useSyncExternalStore } from 'react';

/** Matches a CSS media query, e.g. useMedia('(min-width: 768px)'). */
export const useMedia = (query: string): boolean =>
  useSyncExternalStore(
    cb => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', cb);
      return () => { mql.removeEventListener('change', cb); };
    },
    () => window.matchMedia(query).matches,
    () => false
  );

export const DESKTOP = '(min-width: 768px)';
