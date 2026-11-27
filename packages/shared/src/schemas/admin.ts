import { z } from 'zod';
import {
  categorySlugSchema,
  certificationStatusSchema,
  eligibilityRuleSchema,
  funderTypeSchema,
  giveawayOfferTypeSchema,
  growthPaceSchema,
  nurseryTypeSchema,
  vehicleSchema,
} from '../enums.js';
import { ugandaPhoneSchema } from '../phone.js';
import { analyticsRangeSchema } from '../enums.js';

// Request bodies for /api/v1/admin/*, shared with the admin console.

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lower-case letters, numbers and single hyphens only').max(80);
const money = z.number().int().min(1).max(100_000_000);
const quantity = z.number().int().min(0).max(100_000_000);

/** Requires at least one field in a PATCH body. */
const nonEmpty = <Shape extends z.ZodRawShape>(schema: z.ZodObject<Shape>) =>
  schema.partial().refine(value => Object.keys(value).length > 0, { message: 'Send at least one field to change' });

// ── Nurseries ──────────────────────────────────────────────

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const nurseryCreateSchema = z.object({
  name: text(120),
  type: nurseryTypeSchema,
  /** The district and sub-county are derived from the boundary polygon containing this point */
  location: latLngSchema,
  operator_name: text(120),
  contact_phone: ugandaPhoneSchema,
  payout_phone: ugandaPhoneSchema,
  annual_capacity: quantity,
  seed_source: optionalText(300),
  /** "certified" is set only by recording a verification (PUT /admin/nurseries/:id/certification) */
  certification_status: certificationStatusSchema.exclude(['certified']).default('unverified'),
  is_active: z.boolean().default(true),
});
export const nurseryUpdateSchema = nonEmpty(nurseryCreateSchema.omit({ certification_status: true, is_active: true }).extend({
  certification_status: certificationStatusSchema.exclude(['certified']),
  is_active: z.boolean(),
}));

/** An admin records the certification they checked. Only then is a nursery shown as Certified. */
export const nurseryCertificationSchema = z.object({
  /** Who certified it, e.g. "National Forestry Authority" or "SPGS" */
  body: text(160),
  /** Certificate number or reference */
  ref: optionalText(120),
  /** When the admin checked it; defaults to now */
  verified_at: z.iso.datetime({ offset: true }).optional(),
});

// ── Inventory ──────────────────────────────────────────────

export const inventoryCreateSchema = z.object({
  nursery_id: z.uuid(),
  species_id: z.uuid(),
  quantity_available: quantity,
  unit_price: money,
});
export const inventoryUpdateSchema = nonEmpty(z.object({ quantity_available: quantity, unit_price: money }));

// ── Species ────────────────────────────────────────────────

const localNamesSchema = z
  .array(z.object({ language: text(40), name: text(80) }))
  .max(20)
  .refine(names => new Set(names.map(n => n.language.toLowerCase())).size === names.length, 'One name per language');

const mediaSchema = z
  .array(z.object({
    url: z.string().trim().max(500).refine(u => u.startsWith('/') || /^https:\/\//.test(u), 'Use a site path (/images/…) or an https URL'),
    caption: optionalText(300),
  }))
  .max(20);

/** The five-section Tree Library profile. Every field is optional; empty ones are hidden on the site. */
const profileText = optionalText(4000);
export const speciesProfileFields = {
  botanical_family: optionalText(120),
  appearance_and_identification: profileText,
  growth_characteristics: profileText,
  distribution_and_origin: profileText,
  soil_conditions: profileText,
  rainfall_requirements: profileText,
  climate_and_ecology: profileText,
  propagation_methods: profileText,
  planting_requirements: profileText,
  recommended_spacing: profileText,
  management_practices: profileText,
  economic_uses: profileText,
  environmental_benefits: profileText,
  agroforestry_applications: profileText,
  other_uses: profileText,
};
export type SpeciesProfileField = keyof typeof speciesProfileFields;

/** The sections of a species page, in order, with the fields each one shows. */
export const speciesProfileSections = [
  { key: 'identity', fields: ['botanical_family'] },
  { key: 'about', fields: ['appearance_and_identification', 'growth_characteristics', 'distribution_and_origin'] },
  { key: 'where', fields: ['soil_conditions', 'rainfall_requirements', 'climate_and_ecology'] },
  { key: 'grow', fields: ['propagation_methods', 'planting_requirements', 'recommended_spacing', 'management_practices'] },
  { key: 'uses', fields: ['economic_uses', 'environmental_benefits', 'agroforestry_applications', 'other_uses'] },
] as const satisfies readonly { key: string; fields: readonly SpeciesProfileField[] }[];

const speciesCategoriesSchema = z
  .array(categorySlugSchema)
  .min(1, 'Choose at least one category')
  .max(9)
  .refine(c => new Set(c).size === c.length, 'List each category once');
const heightTimelineSchema = z.array(z.object({ years: z.number().positive().max(200), height_m: z.number().positive().max(150) })).max(20);

export const speciesCreateSchema = z.object({
  common_name: text(120),
  scientific_name: text(160),
  /** Generated from the common name when omitted */
  slug: slugSchema.optional(),
  categories: speciesCategoriesSchema,
  growth_pace: growthPaceSchema,
  height_timeline: heightTimelineSchema.default([]),
  ecological_zones: z.array(text(80)).max(20).default([]),
  local_names: localNamesSchema.default([]),
  media: mediaSchema.default([]),
  ...speciesProfileFields,
});
export const speciesUpdateSchema = nonEmpty(z.object({
  common_name: text(120),
  scientific_name: text(160),
  slug: slugSchema,
  categories: speciesCategoriesSchema,
  growth_pace: growthPaceSchema,
  height_timeline: heightTimelineSchema,
  ecological_zones: z.array(text(80)).max(20),
  /** Replaces all local names when sent */
  local_names: localNamesSchema,
  /** Replaces all media when sent */
  media: mediaSchema,
  ...speciesProfileFields,
}));

// ── Categories (trees and news) ────────────────────────────

/** Tree and news categories have the same shape. The slug is fixed once created. */
export const categoryCreateSchema = z.object({
  slug: categorySlugSchema.optional(),
  label: text(80),
  description: optionalText(300),
  sort_order: z.number().int().min(0).max(1000).default(0),
  is_active: z.boolean().default(true),
});
export const categoryUpdateSchema = nonEmpty(z.object({
  label: text(80),
  description: optionalText(300),
  sort_order: z.number().int().min(0).max(1000),
  is_active: z.boolean(),
}));

// ── News ───────────────────────────────────────────────────

export const newsCreateSchema = z.object({
  title: text(200),
  slug: slugSchema.optional(),
  category: categorySlugSchema,
  body: text(20_000),
  cover_url: optionalText(500),
  is_published: z.boolean().default(false),
  /** Defaults to now when publishing; a future date schedules the post */
  published_at: z.iso.datetime({ offset: true }).optional(),
});
export const newsUpdateSchema = nonEmpty(z.object({
  title: text(200),
  slug: slugSchema,
  category: categorySlugSchema,
  body: text(20_000),
  cover_url: optionalText(500),
  /** Clear it once the category has been checked */
  needs_review: z.boolean(),
  is_published: z.boolean(),
  published_at: z.iso.datetime({ offset: true }).nullable(),
}));

// ── Campaigns ──────────────────────────────────────────────

const eligibilityRulesSchema = z
  .array(eligibilityRuleSchema)
  .max(20)
  .refine(rules => new Set(rules.map(r => r.key)).size === rules.length, 'Each rule needs a unique key');

const campaignItemsSchema = z
  .array(z.object({ species_id: z.uuid(), quantity: z.number().int().min(1).max(10_000_000) }))
  .max(50)
  .refine(items => new Set(items.map(i => i.species_id)).size === items.length, 'List each species once');

const optionalUrl = z.string().trim().max(500).regex(/^https?:\/\//, 'Start with https://').nullable().optional();
const optionalEmail = z.string().trim().toLowerCase().pipe(z.email('Not a valid email address')).nullable().optional();

/** Giveaways (stored as campaigns). */
const campaignFields = z.object({
  title: text(200),
  /** The organizer or programme */
  funder_name: text(200),
  funder_type: funderTypeSchema,
  purpose: text(200),
  offer_type: giveawayOfferTypeSchema,
  /** UGX per seedling, for subsidised giveaways */
  subsidised_price: money.nullable(),
  eligibility_requirements: optionalText(4000),
  application_procedure: optionalText(4000),
  application_deadline: z.iso.datetime({ offset: true }).nullable(),
  contact_phone: ugandaPhoneSchema.nullable(),
  contact_email: optionalEmail,
  website_url: optionalUrl,
  distribution_locations: optionalText(2000),
  /** Applications through this site (needs a pickup nursery, a sub-county and seedlings) */
  accepts_platform_applications: z.boolean(),
  nursery_id: z.uuid().nullable(),
  sub_county_id: z.uuid().nullable(),
  eligibility_rules: eligibilityRulesSchema,
  starts_at: z.iso.datetime({ offset: true }),
  ends_at: z.iso.datetime({ offset: true }),
  is_active: z.boolean(),
  /** The allocation is the sum of item quantities */
  items: campaignItemsSchema,
});

type CampaignShape = Partial<z.output<typeof campaignFields>>;
const datesInOrder = (c: CampaignShape) => !c.starts_at || !c.ends_at || new Date(c.ends_at) > new Date(c.starts_at);
const priceMatchesOffer = (c: CampaignShape) =>
  c.offer_type === undefined || (c.offer_type === 'subsidised') === (c.subsidised_price !== null && c.subsidised_price !== undefined);
/** Checked on create; on update the service checks the merged result. */
const platformFieldsPresent = (c: CampaignShape) =>
  !c.accepts_platform_applications || (!!c.nursery_id && !!c.sub_county_id && (c.items?.length ?? 0) > 0);

export const campaignCreateSchema = campaignFields
  .extend({
    is_active: z.boolean().default(true),
    eligibility_rules: eligibilityRulesSchema.default([]),
    offer_type: giveawayOfferTypeSchema.default('free'),
    subsidised_price: money.nullable().default(null),
    application_deadline: z.iso.datetime({ offset: true }).nullable().default(null),
    contact_phone: ugandaPhoneSchema.nullable().default(null),
    accepts_platform_applications: z.boolean().default(true),
    nursery_id: z.uuid().nullable().default(null),
    sub_county_id: z.uuid().nullable().default(null),
    items: campaignItemsSchema.default([]),
  })
  .refine(datesInOrder, { message: 'ends_at must be after starts_at', path: ['ends_at'] })
  .refine(priceMatchesOffer, { message: 'A subsidised giveaway needs a price per seedling; a free one has none', path: ['subsidised_price'] })
  .refine(platformFieldsPresent, {
    message: 'Applications on this site need a pickup nursery, a sub-county and at least one tree',
    path: ['accepts_platform_applications'],
  });
export const campaignUpdateSchema = nonEmpty(campaignFields)
  .refine(datesInOrder, { message: 'ends_at must be after starts_at', path: ['ends_at'] });

// ── Expert services ────────────────────────────────────────

const serviceListSchema = z
  .array(z.object({ title: text(200), is_active: z.boolean().default(true) }))
  .max(40)
  .refine(list => new Set(list.map(s => s.title.toLowerCase())).size === list.length, 'List each service once');

export const serviceCategoryCreateSchema = z.object({
  slug: slugSchema.optional(),
  title: text(160),
  intro: text(1000),
  icon: z.string().regex(/^[a-z][a-z0-9-]*$/).max(40).default('leaf'),
  sort_order: z.number().int().min(0).max(1000).default(0),
  is_active: z.boolean().default(true),
  /** The services, in order. Sending the list replaces the current one. */
  services: serviceListSchema.default([]),
});
export const serviceCategoryUpdateSchema = nonEmpty(z.object({
  title: text(160),
  intro: text(1000),
  icon: z.string().regex(/^[a-z][a-z0-9-]*$/).max(40),
  sort_order: z.number().int().min(0).max(1000),
  is_active: z.boolean(),
  services: serviceListSchema,
}));

// ── Partners ───────────────────────────────────────────────

const imageUrl = z.string().trim().max(500).refine(u => u.startsWith('/') || /^https:\/\//.test(u), 'Use a site path (/media/…) or an https URL');

export const partnerCreateSchema = z.object({
  name: text(160),
  logo_url: imageUrl.nullable().default(null),
  website_url: optionalUrl,
  sort_order: z.number().int().min(0).max(1000).default(0),
  is_active: z.boolean().default(true),
});
export const partnerUpdateSchema = nonEmpty(z.object({
  name: text(160),
  logo_url: imageUrl.nullable(),
  website_url: optionalUrl,
  sort_order: z.number().int().min(0).max(1000),
  is_active: z.boolean(),
}));

// ── Delivery rates ─────────────────────────────────────────

export const deliveryRateCreateSchema = z.object({
  vehicle: vehicleSchema,
  max_items: z.number().int().min(1).max(10_000_000),
  base_fee: z.number().int().min(0).max(10_000_000),
  per_km: z.number().int().min(0).max(1_000_000),
  max_km: z.number().int().min(1).max(2000),
  active: z.boolean().default(true),
});
export const deliveryRateUpdateSchema = nonEmpty(deliveryRateCreateSchema.omit({ active: true }).extend({ active: z.boolean() }));

// ── Insights ───────────────────────────────────────────────

export const analyticsQuerySchema = z.object({ range: analyticsRangeSchema.default('30d') });

