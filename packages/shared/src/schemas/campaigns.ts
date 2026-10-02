import { z } from 'zod';
import { applicationStatusSchema } from '../enums.js';

/** Answers to a campaign's eligibility checklist, keyed by rule key. */
export const eligibilityAnswersSchema = z.record(
  z.string().regex(/^[a-z][a-z0-9_]*$/).max(50),
  z.union([z.boolean(), z.number(), z.string().max(500)])
);

export const campaignApplySchema = z.object({
  answers: eligibilityAnswersSchema,
  quantity_requested: z.number().int().min(1).max(100_000),
});
export type CampaignApplyRequest = z.input<typeof campaignApplySchema>;

/** Admin decision on an application. `collected` records that an approved applicant picked up the seedlings. */
export const applicationReviewSchema = z.object({
  status: z.enum(['approved', 'rejected', 'collected']),
  note: z.string().trim().max(500).optional(),
});

export const applicationsQuerySchema = z.object({ status: applicationStatusSchema.optional() });
