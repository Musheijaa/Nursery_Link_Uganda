import { z } from 'zod';
import {
  certificationStatusSchema,
  eligibilityRuleSchema,
  funderTypeSchema,
  growthPaceSchema,
  newsCategorySchema,
  nurseryTypeSchema,
  speciesCategorySchema,
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
  certification_status: certificationStatusSchema.default('unverified'),
  is_active: z.boolean().default(true),
});
export const nurseryUpdateSchema = nonEmpty(nurseryCreateSchema.omit({ certification_status: true, is_active: true }).extend({
  certification_status: certificationStatusSchema,
  is_active: z.boolean(),
}));

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

export const speciesCreateSchema = z.object({
  common_name: text(120),
  scientific_name: text(160),
  /** Generated from the common name when omitted */
  slug: slugSchema.optional(),
  category: speciesCategorySchema,
  growth_pace: growthPaceSchema,
  height_timeline: z.array(z.object({ years: z.number().positive().max(200), height_m: z.number().positive().max(150) })).max(20).default([]),
  canopy_notes: optionalText(2000),
  root_notes: optionalText(2000),
  ecological_zones: z.array(text(80)).max(20).default([]),
  local_names: localNamesSchema.default([]),
  media: mediaSchema.default([]),
});
export const speciesUpdateSchema = nonEmpty(z.object({
  common_name: text(120),
  scientific_name: text(160),
  slug: slugSchema,
  category: speciesCategorySchema,
  growth_pace: growthPaceSchema,
  height_timeline: z.array(z.object({ years: z.number().positive().max(200), height_m: z.number().positive().max(150) })).max(20),
  canopy_notes: optionalText(2000),
  root_notes: optionalText(2000),
  ecological_zones: z.array(text(80)).max(20),
  /** Replaces all local names when sent */
  local_names: localNamesSchema,
  /** Replaces all media when sent */
  media: mediaSchema,
}));

// ── News ───────────────────────────────────────────────────

export const newsCreateSchema = z.object({
  title: text(200),
  slug: slugSchema.optional(),
  category: newsCategorySchema,
  body: text(20_000),
  cover_url: optionalText(500),
  is_published: z.boolean().default(false),
  /** Defaults to now when publishing; a future date schedules the post */
  published_at: z.iso.datetime({ offset: true }).optional(),
});
export const newsUpdateSchema = nonEmpty(z.object({
  title: text(200),
  slug: slugSchema,
  category: newsCategorySchema,
  body: text(20_000),
  cover_url: optionalText(500),
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
  .min(1)
  .max(50)
  .refine(items => new Set(items.map(i => i.species_id)).size === items.length, 'List each species once');

const campaignFields = z.object({
  nursery_id: z.uuid(),
  title: text(200),
  funder_name: text(200),
  funder_type: funderTypeSchema,
  purpose: text(200),
  sub_county_id: z.uuid(),
  eligibility_rules: eligibilityRulesSchema,
  starts_at: z.iso.datetime({ offset: true }),
  ends_at: z.iso.datetime({ offset: true }),
  is_active: z.boolean(),
  /** The allocation is the sum of item quantities */
  items: campaignItemsSchema,
});

const datesInOrder = (c: { starts_at?: string | undefined; ends_at?: string | undefined }) =>
  !c.starts_at || !c.ends_at || new Date(c.ends_at) > new Date(c.starts_at);

export const campaignCreateSchema = campaignFields
  .extend({ is_active: z.boolean().default(true), eligibility_rules: eligibilityRulesSchema.default([]) })
  .refine(datesInOrder, { message: 'ends_at must be after starts_at', path: ['ends_at'] });
export const campaignUpdateSchema = nonEmpty(campaignFields).refine(datesInOrder, { message: 'ends_at must be after starts_at', path: ['ends_at'] });

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

