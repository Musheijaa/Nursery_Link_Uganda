import { cn } from '@nurserylink/ui';

/** A tree or news category as the API sends it. Labels are admin-editable, so they always come from the API. */
export type CategoryRef = { slug: string; label: string };

// Category colours (all pairs pass WCAG AA), so lists scan at a glance without icons. Categories an admin
// adds later get the neutral style.
const DARK_MURRAM = 'text-[color-mix(in_srgb,var(--color-murram),black_25%)]';
const NEUTRAL = 'bg-paper text-forest ring-1 ring-line';
const TREE: Record<string, string> = {
  agroforestry: 'bg-seedling-tint text-canopy',
  fruit: `bg-murram-tint ${DARK_MURRAM}`,
  timber: 'bg-sand text-bark',
  medicinal: NEUTRAL,
  ornamental: 'bg-sky-tint text-lake',
  indigenous: 'bg-forest-tint text-forest',
  shade: 'bg-canopy text-paper',
  multipurpose: `bg-sand ${DARK_MURRAM}`,
  other: 'bg-paper text-bark ring-1 ring-line',
};
const NEWS: Record<string, string> = {
  'policy-sector': 'bg-sand text-bark',
  'weather-seasonal': 'bg-sky-tint text-lake',
  'planting-restoration': 'bg-seedling-tint text-canopy',
  'agroforestry-farming': 'bg-forest-tint text-forest',
  'training-events': `bg-murram-tint ${DARK_MURRAM}`,
  'funding-partnerships': 'bg-sun-tint text-canopy',
};

const pill = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap';

export const SpeciesPill = ({ category, className }: { category: CategoryRef; className?: string }) => (
  <span className={cn(pill, TREE[category.slug] ?? NEUTRAL, className)}>{category.label}</span>
);

export const NewsPill = ({ category, className }: { category: CategoryRef; className?: string }) => (
  <span className={cn(pill, NEWS[category.slug] ?? NEUTRAL, className)}>{category.label}</span>
);
