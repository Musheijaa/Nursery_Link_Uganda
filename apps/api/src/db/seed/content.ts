import type { EligibilityRule, FunderType, NewsCategory, Vehicle } from '@nurserylink/shared';

export const DELIVERY_RATES: { vehicle: Vehicle; maxItems: number; baseFee: number; perKm: number; maxKm: number }[] = [
  // A boda boda carries a few crates of potted seedlings over local distances
  { vehicle: 'motorcycle', maxItems: 300, baseFee: 5000, perKm: 1500, maxKm: 40 },
  // A light truck for bulk woodlot and restoration orders
  { vehicle: 'truck', maxItems: 20000, baseFee: 60000, perKm: 2500, maxKm: 200 },
];

// Sample posts for development; the wording makes clear they are not real advisories.
export const NEWS_POSTS: { slug: string; title: string; category: NewsCategory; body: string; publishedAt: string }[] = [
  {
    slug: 'plant-early-in-the-second-rains',
    title: 'Plant early in the second rains',
    category: 'weather',
    publishedAt: '2026-09-22T08:00:00+03:00',
    body:
      'Sample post. The September–November rains are the main second planting window in Mukono. ' +
      'Plant seedlings in the first weeks after the ground is soaked so roots establish before the December dry spell. ' +
      'Order two to four weeks ahead so your nursery can have seedlings hardened and ready.',
  },
  {
    slug: 'grafted-avocado-seedling-prices-steady',
    title: 'Grafted avocado seedling prices steady',
    category: 'market',
    publishedAt: '2026-09-15T08:00:00+03:00',
    body:
      'Sample post. Listed prices for grafted Hass avocado seedlings on Nursery Link stay between UGX 6,000 and 6,500. ' +
      'Buy grafted seedlings only from nurseries that can show where their mother trees came from.',
  },
  {
    slug: 'shoreline-restoration-seedlings-open',
    title: 'Free seedlings for lakeshore restoration now open',
    category: 'grant',
    publishedAt: '2026-09-05T08:00:00+03:00',
    body:
      'Sample post. Households and groups along the Lake Victoria shoreline in Ntenjeru can apply for free indigenous seedlings. ' +
      'See the Free Seedlings page for the eligibility checklist and the pickup nursery.',
  },
];

export interface SeedCampaign {
  title: string;
  funderName: string;
  funderType: FunderType;
  purpose: string;
  /** Pickup nursery, by name (must exist in NURSERIES) */
  nurseryName: string;
  subCountyName: string;
  allocatedStock: number;
  remainingStock: number;
  eligibilityRules: EligibilityRule[];
  startsAt: string;
  endsAt: string;
  /** [species slug, quantity]; quantities add up to allocatedStock */
  items: [string, number][];
}

// Funders are fictional.
export const CAMPAIGNS: SeedCampaign[] = [
  {
    title: 'Lake Victoria shoreline restoration',
    funderName: 'Victoria Basin Trees Trust',
    funderType: 'ngo',
    purpose: 'Shoreline and wetland-edge restoration',
    nurseryName: 'Katosi Lakeshore Seedlings',
    subCountyName: 'Ntenjeru',
    allocatedStock: 20000,
    remainingStock: 13400,
    eligibilityRules: [
      { key: 'lc1_letter', label: 'I have an introduction letter from my LC1 chairperson', type: 'boolean', required: true },
      { key: 'land_acres', label: 'Land to be planted (acres)', type: 'number', required: true },
      { key: 'near_shoreline', label: 'The land is within 1 km of the lake shore', type: 'boolean', required: true },
    ],
    startsAt: '2026-09-01T00:00:00+03:00',
    endsAt: '2026-11-30T23:59:59+03:00',
    items: [['mvule', 5000], ['musizi', 8000], ['nsambya', 4000], ['mutuba', 3000]],
  },
  {
    title: 'Coffee shade trees for Nakisunga farmers',
    funderName: 'Nile Crest Coffee Exporters',
    funderType: 'corporate',
    purpose: 'Coffee shade and agroforestry',
    nurseryName: 'Nakisunga Community Nursery',
    subCountyName: 'Nakisunga',
    allocatedStock: 12000,
    remainingStock: 12000,
    eligibilityRules: [
      { key: 'coffee_farmer', label: 'I grow coffee', type: 'boolean', required: true },
      { key: 'coffee_trees', label: 'Number of coffee trees on your farm', type: 'number', required: true },
      { key: 'farmer_group', label: 'Farmer group (if any)', type: 'text', required: false },
    ],
    startsAt: '2026-09-01T00:00:00+03:00',
    endsAt: '2026-11-30T23:59:59+03:00',
    items: [['grevillea', 5000], ['mugavu', 4000], ['mukebu', 3000]],
  },
];
