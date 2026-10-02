import { useEffect, useState } from 'react';

/** Seconds left until `until` (a timestamp), ticking once a second; 0 when passed. */
export const useCountdown = (until: number): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) window.clearInterval(timer);
    }, 1000);
    return () => { window.clearInterval(timer); };
  }, [until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
};
