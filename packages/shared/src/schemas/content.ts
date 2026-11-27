import { z } from 'zod';
import { enquiryStatusSchema, enquiryTypeSchema, giveawayStatusSchema } from '../enums.js';
import { ugandaPhoneSchema } from '../phone.js';

// ── Enquiries (public forms → admin Inbox) ─────────────────

const optionalText = (max: number) => z.string().trim().max(max).optional();
const email = z.string().trim().toLowerCase().pipe(z.email('Not a valid email address'));

const contactFields = {
  name: z.string().trim().min(2, 'Please give your name').max(100),
  phone: ugandaPhoneSchema.optional(),
  email: email.optional(),
  organization: optionalText(160),
  district: optionalText(100),
  message: z.string().trim().min(10, 'Please write at least a few words (10 letters or more)').max(2000, 'Please keep it under 2,000 letters'),
  consent: z.literal(true, 'Please agree so the team can contact you'),
  /** Spam trap: a field people never see. Anything in it means a bot; the API pretends to accept it. */
  website: z.string().max(500).optional(),
};

const needsPhoneOrEmail = (e: { phone?: string | undefined; email?: string | undefined }) => !!e.phone || !!e.email;
const phoneOrEmailIssue = { message: 'Give a phone number or an email address so we can reply', path: ['phone'] };

/** Request an expert service: phone and district are needed to arrange it. */
export const serviceEnquirySchema = z.object({
  type: z.literal('service'),
  ...contactFields,
  phone: ugandaPhoneSchema,
  district: z.string().trim().min(2, 'Say which district the work is in').max(100),
  service_category_id: z.uuid(),
  service_ids: z.array(z.uuid()).min(1, 'Choose at least one service').max(40),
});

/** Donation, partnership and contact forms on /donate (and the contact form). */
export const generalEnquirySchema = z
  .object({ type: z.enum(['donation', 'partnership', 'contact']), ...contactFields })
  .refine(needsPhoneOrEmail, phoneOrEmailIssue);

export const enquiryCreateSchema = z.union([serviceEnquirySchema, generalEnquirySchema]);
export type EnquiryCreate = z.input<typeof enquiryCreateSchema>;

/** Admin moves an enquiry on, with an optional note for the team. */
export const enquiryUpdateSchema = z.object({
  status: enquiryStatusSchema,
  note: z.string().trim().max(1000).optional(),
});

export const enquiriesQuerySchema = z.object({
  type: enquiryTypeSchema.optional(),
  status: enquiryStatusSchema.optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

// ── Page content (editable site copy) ──────────────────────

const stepsData = z.strictObject({
  steps: z.array(z.strictObject({ title: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(400) })).min(1).max(8),
});
const contactData = z.strictObject({
  phone: ugandaPhoneSchema.nullable(),
  email: email.nullable(),
  whatsapp: ugandaPhoneSchema.nullable(),
});
const heroData = z.strictObject({ eyebrow: z.string().trim().max(80) });
const none = z.strictObject({});

/**
 * Every editable block of site copy: what it is, and the shape of its structured `data`.
 * Title, subtitle and body (Markdown) are free text. The web app falls back to its own copy for any key
 * the API doesn't return.
 */
export const pageContentKeys = {
  'home.hero': { label: 'Home: welcome (hero)', data: heroData },
  'home.how_it_works': { label: 'Home: how it works', data: stepsData },
  'home.partners': { label: 'Home: partners and supporters', data: none },
  'library.intro': { label: 'Tree Library: introduction', data: none },
  'expert_services.intro': { label: 'Expert Services: introduction', data: none },
  'news.intro': { label: 'News & Updates: introduction', data: none },
  'giveaways.intro': { label: 'Giveaways: introduction', data: none },
  'donate.page': { label: 'Donate: page text', data: none },
  'donate.payment_instructions': { label: 'Donate: how to send a donation (MoMo, bank)', data: none },
  'site.contact': { label: 'Contact details (phone, email, WhatsApp)', data: contactData },
} as const;
export type PageContentKey = keyof typeof pageContentKeys;
export const pageContentKeyList = Object.keys(pageContentKeys) as PageContentKey[];
export const pageContentKeySchema = z.enum(pageContentKeyList as [PageContentKey, ...PageContentKey[]]);

export const pageContentUpdateSchema = z
  .object({
    title: z.string().trim().max(200).nullable().optional(),
    subtitle: z.string().trim().max(300).nullable().optional(),
    body: z.string().trim().max(20_000).nullable().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(v => Object.keys(v).length > 0, { message: 'Send at least one field to change' });

/** Checks `data` against its key's shape and normalises it (phone numbers to E.164, emails lower-case). */
export const parsePageContentData = (
  key: PageContentKey,
  data: unknown
): { ok: true; data: Record<string, unknown> } | { ok: false; issues: z.core.$ZodIssue[] } => {
  const result = pageContentKeys[key].data.safeParse(data);
  return result.success ? { ok: true, data: result.data } : { ok: false, issues: result.error.issues };
};

// ── Giveaways ──────────────────────────────────────────────

export const giveawaysQuerySchema = z.object({
  /** Open includes closing soon. Default: open. */
  status: giveawayStatusSchema.optional(),
  sub_county_id: z.uuid().optional(),
  purpose: z.string().trim().min(1).max(100).optional(),
});

/** Days before the deadline when an open giveaway counts as "closing soon". */
export const GIVEAWAY_CLOSING_SOON_DAYS = 14;
