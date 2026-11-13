/**
 * Central Uganda's planting calendar: two rainy seasons, March–May and September–November. The
 * month before each is for ordering seedlings and digging holes; the rest is dry. Shared by the
 * News page's calendar and the site assistant, so they never disagree.
 */
export type PlantingSeason = 'rains' | 'prep' | 'dry';

/** January … December */
export const PLANTING_SEASONS: readonly PlantingSeason[] = ['dry', 'prep', 'rains', 'rains', 'rains', 'dry', 'dry', 'prep', 'rains', 'rains', 'rains', 'dry'];

/** This month in Kampala, 0–11. */
export const kampalaMonth = (now: Date): number =>
  Number(new Intl.DateTimeFormat('en-GB', { month: 'numeric', timeZone: 'Africa/Kampala' }).format(now)) - 1;

export const seasonOfMonth = (month: number): PlantingSeason => PLANTING_SEASONS[((month % 12) + 12) % 12] ?? 'dry';

/** The next month (0–11) after `month` in which the given season starts. */
export const nextSeasonStart = (month: number, season: PlantingSeason): number => {
  for (let step = 1; step <= 12; step++) {
    const m = (month + step) % 12;
    if (seasonOfMonth(m) === season && seasonOfMonth(m - 1) !== season) return m;
  }
  return month;
};
