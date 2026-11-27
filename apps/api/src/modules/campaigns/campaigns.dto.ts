import type { CampaignDto } from '@nurserylink/shared';
import type { CampaignRow } from './campaigns.repo.js';

/** A giveaway (campaign) as the directory (FR-16) and the admin console show it, including the stock meter. */
export const toCampaign = (c: Omit<CampaignRow, 'total'>): CampaignDto => ({
  id: c.id,
  title: c.title,
  funder_name: c.funder_name,
  funder_type: c.funder_type,
  purpose: c.purpose,
  offer_type: c.offer_type,
  subsidised_price: c.subsidised_price,
  eligibility_requirements: c.eligibility_requirements,
  application_procedure: c.application_procedure,
  application_deadline: c.application_deadline ? new Date(c.application_deadline).toISOString() : null,
  closes_at: new Date(c.closes_at).toISOString(),
  contact: { phone: c.contact_phone, email: c.contact_email, website: c.website_url },
  distribution_locations: c.distribution_locations,
  accepts_platform_applications: c.accepts_platform_applications,
  allocated_stock: c.allocated_stock,
  remaining_stock: c.remaining_stock,
  // Rounded down, so 100% only ever means nothing has been given out yet
  remaining_pct: c.allocated_stock > 0 ? Math.floor((c.remaining_stock / c.allocated_stock) * 100) : 0,
  eligibility_rules: c.eligibility_rules,
  starts_at: new Date(c.starts_at).toISOString(),
  ends_at: new Date(c.ends_at).toISOString(),
  is_active: c.is_active,
  status: c.status,
  is_open: c.is_open,
  species: c.species,
  sub_county: c.sub_county_id && c.sub_county_name ? { id: c.sub_county_id, name: c.sub_county_name } : null,
  pickup_nursery:
    c.nursery_id && c.nursery_name && c.nursery_lat !== null && c.nursery_lng !== null
      ? { id: c.nursery_id, name: c.nursery_name, location: { lat: c.nursery_lat, lng: c.nursery_lng } }
      : null,
});
