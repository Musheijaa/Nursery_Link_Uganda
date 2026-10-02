import { useEffect, useState } from 'react';

/** `value`, but only once it has stopped changing for `ms` (so typing isn't a request per key). */
export const useDebounced = <T,>(value: T, ms: number): T => {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => { setSettled(value); }, ms);
    return () => { window.clearTimeout(timer); };
  }, [value, ms]);
  return settled;
};
