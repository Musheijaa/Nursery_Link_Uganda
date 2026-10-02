import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/** A URL query parameter as state (so filters and pages survive reloads and can be shared). */
export const useParam = (key: string): [string | null, (value: string | null, opts?: { replace?: boolean; resetPage?: boolean }) => void] => {
  const [params, setParams] = useSearchParams();
  const set = useCallback(
    (value: string | null, { replace = false, resetPage = true } = {}) => {
      setParams(prev => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        if (resetPage && key !== 'page') next.delete('page');
        return next;
      }, { replace });
    },
    [key, setParams]
  );
  return [params.get(key), set];
};

export const usePage = (): [number, (p: number) => void] => {
  const [raw, set] = useParam('page');
  return [Math.max(1, Number(raw) || 1), p => { set(p > 1 ? String(p) : null); }];
};
