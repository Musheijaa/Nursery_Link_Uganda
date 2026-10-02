import type { z } from 'zod';
import type { ApplicationStatus, applicationReviewSchema, campaignApplySchema, PaginationMeta } from '@nurserylink/shared';
import type { Database } from '../../db/client.js';
import type { JobQueue } from '../../jobs/queue.js';
import { writeAudit } from '../../lib/audit.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { paginationMeta, toOffset, type Pagination } from '../../lib/pagination.js';
import { pgErrorCode } from '../../middleware/errorHandler.js';
import * as repo from './applications.repo.js';
import { checkEligibility } from '@nurserylink/shared';

type ApplyInput = z.output<typeof campaignApplySchema>;
type ReviewInput = z.output<typeof applicationReviewSchema>;

const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

/** API shape. The applicant's details are included only for admins. */
export const toApplicationDto = (a: repo.ApplicationRow, forAdmin: boolean) => ({
  id: a.id,
  campaign: { id: a.campaign_id, title: a.campaign_title, pickup_nursery: a.pickup_nursery },
  answers: a.answers,
  quantity_requested: a.quantity_requested,
  status: a.status,
  ...(forAdmin ? { applicant: { id: a.user_id, full_name: a.applicant_name, phone: a.applicant_phone }, reviewed_by: a.reviewed_by } : {}),
  reviewed_at: iso(a.reviewed_at),
  created_at: new Date(a.created_at).toISOString(),
});
export type ApplicationDto = ReturnType<typeof toApplicationDto>;

// Which review decisions each status allows
const REVIEW_TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  pending: ['approved', 'rejected'],
  approved: ['collected'],
  rejected: [],
  collected: [],
};

/**
 * Free-seedling campaign applications (FR-17). Buyers apply once per campaign; admins approve,
 * which takes the seedlings from the campaign's remaining stock, or reject.
 */
export class ApplicationsService {
  constructor(private readonly deps: { db: Database; queue: JobQueue }) {}

  async apply(userId: string, campaignId: string, input: ApplyInput): Promise<ApplicationDto> {
    const { db } = this.deps;
    const campaign = await repo.campaignForApply(db, campaignId);
    if (!campaign) throw new NotFoundError('Campaign not found');
    if (!campaign.is_open) throw new ConflictError('This campaign is not accepting applications');
    if (input.quantity_requested > campaign.remaining_stock) {
      throw new ConflictError(`Only ${String(campaign.remaining_stock)} seedlings are left in this campaign`, { remaining_stock: campaign.remaining_stock });
    }
    const eligibility = checkEligibility(campaign.eligibility_rules, input.answers);
    if (!eligibility.ok) throw new ValidationError('Some answers do not meet this campaign\'s requirements', eligibility.problems);

    let id: string;
    try {
      id = await repo.insertApplication(db, { campaignId, userId, answers: eligibility.answers, quantityRequested: input.quantity_requested });
    } catch (err) {
      if (pgErrorCode(err) === '23505') throw new ConflictError('You have already applied to this campaign');
      throw err;
    }
    return this.dto(id, false);
  }

  async listMine(userId: string, page: Pagination): Promise<{ items: ApplicationDto[]; meta: PaginationMeta }> {
    const rows = await repo.listForUser(this.deps.db, userId, page.limit, toOffset(page));
    return { items: rows.map(r => toApplicationDto(r, false)), meta: paginationMeta(page, rows[0]?.total ?? 0) };
  }

  async listForCampaign(campaignId: string, status: ApplicationStatus | undefined, page: Pagination) {
    if (!(await repo.campaignExists(this.deps.db, campaignId))) throw new NotFoundError('Campaign not found');
    const rows = await repo.listForCampaign(this.deps.db, campaignId, status, page.limit, toOffset(page));
    return { items: rows.map(r => toApplicationDto(r, true)), meta: paginationMeta(page, rows[0]?.total ?? 0) };
  }

  /**
   * Approve, reject, or mark as collected. Approval takes the requested seedlings from the
   * campaign's remaining stock under a row lock, and is refused if that would go below zero.
   */
  async review(actorId: string, applicationId: string, input: ReviewInput): Promise<ApplicationDto> {
    const { db } = this.deps;
    const reviewed = await db.transaction(async tx => {
      const before = await repo.findApplication(tx, applicationId, true);
      if (!before) throw new NotFoundError('Application not found');
      if (!REVIEW_TRANSITIONS[before.status].includes(input.status)) {
        throw new ConflictError(`An application that is ${before.status} cannot be marked ${input.status}`, { from: before.status, to: input.status });
      }

      let remainingAfter: number | undefined;
      if (input.status === 'approved') {
        const campaign = await repo.campaignForApply(tx, before.campaign_id, true);
        if (!campaign) throw new NotFoundError('Campaign not found');
        if (campaign.remaining_stock < before.quantity_requested) {
          throw new ConflictError(`Only ${String(campaign.remaining_stock)} seedlings are left; this application asks for ${String(before.quantity_requested)}`, {
            remaining_stock: campaign.remaining_stock,
          });
        }
        await repo.decrementCampaignStock(tx, before.campaign_id, before.quantity_requested);
        remainingAfter = campaign.remaining_stock - before.quantity_requested;
      }

      await repo.setApplicationStatus(tx, applicationId, input.status, actorId);
      const after = await repo.findApplication(tx, applicationId);
      if (!after) throw new Error('Application vanished');
      await writeAudit(tx, {
        actorId,
        action: `application.${input.status}`,
        entity: 'campaign_application',
        entityId: applicationId,
        before: { status: before.status },
        after: {
          status: input.status,
          note: input.note ?? null,
          campaign_id: before.campaign_id,
          quantity: before.quantity_requested,
          ...(remainingAfter === undefined ? {} : { campaign_remaining_stock: remainingAfter }),
        },
      });
      return after;
    });

    await this.notify(reviewed, input.status);
    return toApplicationDto(reviewed, true);
  }

  private async notify(a: repo.ApplicationRow, status: ReviewInput['status']) {
    const message =
      status === 'approved'
        ? `NurseryLink: your application to "${a.campaign_title}" is approved for ${String(a.quantity_requested)} free seedlings. Collect them from ${a.pickup_nursery}. Bring this SMS.`
        : status === 'rejected'
          ? `NurseryLink: sorry, your application to "${a.campaign_title}" was not approved this time.`
          : undefined;
    if (message) await this.deps.queue.send('sms-send', { to: a.applicant_phone, message });
  }

  private async dto(id: string, forAdmin: boolean): Promise<ApplicationDto> {
    const row = await repo.findApplication(this.deps.db, id);
    if (!row) throw new NotFoundError('Application not found');
    return toApplicationDto(row, forAdmin);
  }
}
