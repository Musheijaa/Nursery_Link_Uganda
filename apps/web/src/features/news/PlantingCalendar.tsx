import { cn } from '@nurserylink/ui';
import { en } from '../../copy/en';

type Season = 'rains' | 'prep' | 'dry';

// Central Uganda's two rainy seasons: March–May and September–November.
// The month before each is for ordering seedlings and digging holes.
const SEASONS: readonly Season[] = ['dry', 'prep', 'rains', 'rains', 'rains', 'dry', 'dry', 'prep', 'rains', 'rains', 'rains', 'dry'];

const TONE: Record<Season, string> = {
  rains: 'bg-sky-tint text-lake',
  prep: 'bg-murram-tint text-[color-mix(in_srgb,var(--color-murram),black_25%)]',
  dry: 'bg-sand text-bark-muted',
};

const monthShort = new Intl.DateTimeFormat('en-GB', { month: 'narrow', timeZone: 'UTC' });
const monthLong = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' });
const monthName = (i: number, fmt: Intl.DateTimeFormat) => fmt.format(new Date(Date.UTC(2026, i, 15)));

/** This month in Kampala, 0–11. */
const currentMonth = (now: Date) => Number(new Intl.DateTimeFormat('en-GB', { month: 'numeric', timeZone: 'Africa/Kampala' }).format(now)) - 1;

/** The year's planting seasons, with this month marked and what to do now. */
export const PlantingCalendar = ({ now = new Date() }: { now?: Date }) => {
  const c = en.news.calendar;
  const month = currentMonth(now);
  const season = SEASONS[month] ?? 'dry';
  return (
    <section aria-labelledby="planting-calendar" className="flex flex-col gap-3 rounded-lg bg-paper p-5 shadow-card ring-1 ring-line">
      <h2 id="planting-calendar" className="text-xl">{c.heading}</h2>
      <p className="text-sm text-bark-muted">{c.intro}</p>
      <ol aria-label={c.monthsLabel} className="grid grid-cols-12 gap-1">
        {SEASONS.map((s, i) => (
          <li
            key={i}
            aria-current={i === month ? 'date' : undefined}
            className={cn('flex h-10 items-center justify-center rounded text-sm font-bold', TONE[s], i === month && 'ring-2 ring-canopy ring-offset-1')}
          >
            <span aria-hidden>{monthName(i, monthShort)}</span>
            <span className="sr-only">{`${monthName(i, monthLong)}: ${c.seasons[s]}`}</span>
          </li>
        ))}
      </ol>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-bark-muted">
        {(['rains', 'prep', 'dry'] as const).map(s => (
          <li key={s} className="flex items-center gap-1.5">
            <span aria-hidden className={cn('size-3 rounded-sm', TONE[s])} />
            {c.seasons[s]}
          </li>
        ))}
      </ul>
      <div className={cn('flex flex-col gap-1 rounded-md p-3', TONE[season])}>
        <p className="font-bold">{`${c.now(monthName(month, monthLong))} · ${c.seasons[season]}`}</p>
        <p className="text-sm text-bark">{c.todo[season]}</p>
      </div>
    </section>
  );
};
