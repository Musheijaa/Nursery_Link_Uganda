import { useEffect, useRef, useState } from 'react';
import { en } from '../../copy/en';

interface Point {
  years: number;
  height_m: number;
}

// Top padding fits the largest tree glyph drawn above the final point
const PAD = { left: 48, right: 28, top: 60, bottom: 40 };

/** A round axis maximum: 35 m → 40, 12 m → 15. */
const niceMax = (v: number) => {
  const steps = [5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100];
  return steps.find(s => s >= v) ?? Math.ceil(v / 10) * 10;
};

/** A tree glyph whose size follows its height, so the drawing shows the tree growing up. */
const Tree = ({ x, y, size }: { x: number; y: number; size: number }) => (
  <g transform={`translate(${String(x)} ${String(y)})`} aria-hidden>
    <line x1={0} y1={0} x2={0} y2={-size * 0.45} stroke="var(--color-canopy)" strokeWidth={Math.max(1.5, size / 14)} strokeLinecap="round" />
    <ellipse cx={0} cy={-size * 0.62} rx={size * 0.34} ry={size * 0.3} fill="var(--color-seedling-tint)" stroke="var(--color-seedling)" strokeWidth={2} />
  </g>
);

/**
 * Height over the years, drawn like a botanical growth figure: the line rises from seedling to
 * mature tree, with a tree drawn at each milestone. Screen readers get the same facts as a list.
 */
export const GrowthChart = ({ timeline }: { timeline: Point[] }) => {
  // Laid out at its real width (not scaled), so labels stay 13 px on a phone
  const box = useRef<HTMLElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    // Older browsers (and test DOMs) without ResizeObserver keep the default width, scaled to fit
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setW(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => { observer.disconnect(); };
  }, []);
  const H = W < 480 ? 220 : 280;
  const points = [...timeline].sort((a, b) => a.years - b.years);
  if (points.length === 0) return null;
  const maxYears = Math.max(...points.map(p => p.years));
  const maxHeight = niceMax(Math.max(...points.map(p => p.height_m)));
  const x = (years: number) => PAD.left + (years / maxYears) * (W - PAD.left - PAD.right);
  const y = (m: number) => H - PAD.bottom - (m / maxHeight) * (H - PAD.top - PAD.bottom);
  const path = [`M ${String(x(0))} ${String(y(0))}`, ...points.map(p => `L ${String(x(p.years))} ${String(y(p.height_m))}`)].join(' ');
  const ticks = [0, maxHeight / 2, maxHeight];

  return (
    <figure ref={box} className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${String(W)} ${String(H)}`} width={W} height={H} role="img" aria-labelledby="growth-title" className="h-auto max-w-full">
        <title id="growth-title">{points.map(p => en.species.heightAt(p.years, p.height_m)).join('; ')}</title>
        {/* Ground and height guides */}
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeDasharray={t === 0 ? undefined : '4 6'} strokeWidth={t === 0 ? 2 : 1} />
            <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="central" className="fill-bark-muted text-[13px]">{en.species.metres(t)}</text>
          </g>
        ))}
        <path d={path} fill="none" stroke="var(--color-seedling)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={p.years}>
            <line x1={x(p.years)} x2={x(p.years)} y1={y(0)} y2={y(p.height_m)} stroke="var(--color-seedling)" strokeOpacity={0.25} strokeWidth={1} />
            <Tree x={x(p.years)} y={y(p.height_m)} size={14 + (p.height_m / maxHeight) * 46} />
            {/* Drop a year label that would overlap its neighbour (the full list is in the title) */}
            {(i === points.length - 1 || x(points[i + 1]?.years ?? Infinity) - x(p.years) > 56) && (
              <text x={x(p.years)} y={H - PAD.bottom + 22} textAnchor={i === points.length - 1 ? 'end' : 'middle'} className="fill-bark text-[13px] font-bold">
                {en.species.yearsLabel(p.years)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <figcaption className="text-sm text-bark-muted">{en.species.growthCaption}</figcaption>
    </figure>
  );
};
