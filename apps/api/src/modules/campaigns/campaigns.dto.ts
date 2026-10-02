import type { CampaignDto } from '@nurserylink/shared';
import type { CampaignRow } from './campaigns.repo.js';

/** A campaign as the directory (FR-16) and the admin console show it, including the stock meter. */
export const toCampaign = (c: Omit<CampaignRow, 'total'>): CampaignDto => ({
  id: c.id,
  title: c.title,
  funder_name: c.funder_name,
  funder_type: c.funder_type,
  purpose: c.purpose,
  allocated_stock: c.allocated_stock,
  remaining_stock: c.remaining_stock,
  // Rounded down, so 100% only ever means nothing has been given out yet
  remaining_pct: Math.floor((c.remaining_stock / c.allocated_stock) * 100),
  eligibility_rules: c.eligibility_rules,
  starts_at: new Date(c.starts_at).toISOString(),
  ends_at: new Date(c.ends_at).toISOString(),
  is_active: c.is_active,
  is_open: c.is_open,
  species: c.species,
  sub_county: { id: c.sub_county_id, name: c.sub_county_name },
  pickup_nursery: { id: c.nursery_id, name: c.nursery_name, location: { lat: c.nursery_lat, lng: c.nursery_lng } },
});
