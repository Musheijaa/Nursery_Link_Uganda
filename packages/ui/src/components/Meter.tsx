import { cn } from '../lib/cn';

/** Remaining-stock meter for free-seedling campaigns (a Sun bar: campaign elements only). */
export const StockMeter = ({ remaining, total, label, className }: { remaining: number; total: number; label: string; className?: string }) => {
  const pct = total > 0 ? Math.round((remaining / total) * 100) : 0;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={remaining}
        aria-valuetext={`${String(pct)}% left`}
        className="h-3 overflow-hidden rounded-full bg-mist ring-1 ring-canopy/30"
      >
        <div className="h-full rounded-full bg-sun ring-1 ring-canopy/60" style={{ width: `${String(pct)}%` }} />
      </div>
    </div>
  );
};
