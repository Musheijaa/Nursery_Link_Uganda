import type { z } from 'zod';
import type {
  AdminEnquiryDto,
  EnquiryReceiptDto,
  EnquiryType,
  PaginationMeta,
  enquiryCreateSchema,
  enquiryUpdateSchema,
  feedbackCreateSchema,
} from '@nurserylink/shared';
import { toE164UgandaMobile } from '@nurserylink/shared';
import type { Logger } from 'pino';
import type { Config } from '../../config.js';
import type { Database } from '../../db/client.js';
import type { JobQueue } from '../../jobs/queue.js';
import { writeAudit } from '../../lib/audit.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { paginationMeta, toOffset, type Pagination } from '../../lib/pagination.js';
import { toCsv } from '../exports/exports.service.js';
import * as repo from './enquiries.repo.js';

type CreateInput = z.output<typeof enquiryCreateSchema>;
type FeedbackInput = z.output<typeof feedbackCreateSchema>;
type UpdateInput = z.output<typeof enquiryUpdateSchema>;

const TYPE_LABEL: Record<EnquiryType, string> = {
  service: 'expert service request',
  donation: 'donation enquiry',
  partnership: 'partnership enquiry',
  contact: 'message',
  feedback: 'feedback',
};

export const toAdminEnquiry = (r: Omit<repo.EnquiryRow, 'total'>): AdminEnquiryDto => ({
  id: r.id,
  type: r.type,
  status: r.status,
  name: r.name,
  phone: r.phone,
  email: r.email,
  organization: r.organization,
  district: r.district,
  message: r.message,
  consent: r.consent,
  service_category: r.service_category_id && r.service_category_title ? { id: r.service_category_id, title: r.service_category_title } : null,
  services: r.services,
  details: r.details,
  user_id: r.user_id,
  admin_note: r.admin_note,
  handled_by: r.handled_by,
  created_at: new Date(r.created_at).toISOString(),
  updated_at: new Date(r.updated_at).toISOString(),
});

/**
 * Everything people send the team lands in one inbox: expert service requests, donation and
 * partnership offers, contact messages and site feedback. Nobody needs an account. The team hears
 * about each new one by email and/or SMS (ENQUIRY_NOTIFY_EMAIL, ENQUIRY_NOTIFY_PHONE).
 */
export class EnquiriesService {
  constructor(private readonly deps: { db: Database; queue: JobQueue; config: Config; logger: Logger }) {}

  async create(userId: string | null, input: CreateInput): Promise<EnquiryReceiptDto> {
    const { db } = this.deps;
    let serviceCategoryId: string | null = null;
    let services: string[] = [];
    if (input.type === 'service') {
      const resolved = await repo.resolveServices(db, input.service_category_id, input.service_ids);
      if (!resolved.category) throw new ValidationError('That service area is not offered', [{ path: 'service_category_id', message: 'Choose a service area from the list' }]);
      if (resolved.titles.length !== new Set(input.service_ids).size) {
        throw new ValidationError('Some services are not offered', [{ path: 'service_ids', message: 'Choose services from the list' }]);
      }
      serviceCategoryId = resolved.category.id;
      services = resolved.titles;
    }
    const row = await repo.insertEnquiry(db, {
      type: input.type,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      organization: input.organization ? input.organization : null,
      district: input.district ? input.district : null,
      message: input.message,
      consent: input.consent,
      serviceCategoryId,
      services,
      details: {},
      userId,
    });
    await this.notify(input.type, input.name, input.message, services);
    return { id: row.id, created_at: new Date(row.created_at).toISOString() };
  }

  /** Site feedback (/feedback). Signed-in people are known from their account; others may leave a contact. */
  async createFeedback(userId: string | null, input: FeedbackInput): Promise<EnquiryReceiptDto> {
    const account = userId ? await repo.findUserContact(this.deps.db, userId) : undefined;
    const contact = input.contact ? input.contact : null;
    const contactPhone = contact ? toE164UgandaMobile(contact) : null;
    const contactEmail = contact?.includes('@') ? contact.toLowerCase() : null;
    const row = await repo.insertEnquiry(this.deps.db, {
      type: 'feedback',
      name: account?.full_name ?? (input.name ? input.name : null),
      phone: account?.phone ?? contactPhone,
      email: account?.email ?? contactEmail,
      organization: null,
      district: null,
      message: input.message,
      consent: true,
      serviceCategoryId: null,
      services: [],
      details: { kind: input.kind, page: input.page ?? null, ...(contact && !contactPhone && !contactEmail ? { contact } : {}) },
      userId,
    });
    await this.notify('feedback', account?.full_name ?? input.name ?? null, input.message, []);
    return { id: row.id, created_at: new Date(row.created_at).toISOString() };
  }

  async list(filters: repo.EnquiryFilters, page: Pagination): Promise<{ items: AdminEnquiryDto[]; meta: PaginationMeta }> {
    const rows = await repo.listEnquiries(this.deps.db, filters, page.limit, toOffset(page));
    return { items: rows.map(toAdminEnquiry), meta: paginationMeta(page, rows[0]?.total ?? 0) };
  }

  async get(id: string): Promise<AdminEnquiryDto> {
    const row = await repo.findEnquiry(this.deps.db, id);
    if (!row) throw new NotFoundError('Enquiry not found');
    return toAdminEnquiry(row);
  }

  /** Moves an enquiry to new, in progress or closed, with an optional note (locked and audited). */
  async update(actorId: string, id: string, input: UpdateInput): Promise<AdminEnquiryDto> {
    return this.deps.db.transaction(async tx => {
      const before = await repo.findEnquiry(tx, id, true);
      if (!before) throw new NotFoundError('Enquiry not found');
      await repo.updateEnquiryStatus(tx, id, input.status, input.note ? input.note : null, actorId);
      const after = await repo.findEnquiry(tx, id);
      if (!after) throw new Error('Enquiry vanished');
      const dto = toAdminEnquiry(after);
      await writeAudit(tx, { actorId, action: `enquiry.${input.status}`, entity: 'enquiry', entityId: id, before: toAdminEnquiry(before), after: dto });
      return dto;
    });
  }

  async counts(): Promise<{ new_by_type: Record<EnquiryType, number>; new_total: number }> {
    const byType = await repo.countNewByType(this.deps.db);
    return { new_by_type: byType, new_total: Object.values(byType).reduce((a, b) => a + b, 0) };
  }

  /** The inbox as CSV (UTF-8 with BOM, formula-safe), with the same filters as the list */
  async exportCsv(filters: repo.EnquiryFilters): Promise<string> {
    const rows = await repo.exportEnquiries(this.deps.db, filters);
    const header = ['created_at', 'type', 'status', 'name', 'phone', 'email', 'organization', 'district', 'service_area', 'services', 'message', 'admin_note', 'id'];
    return '﻿' + toCsv(
      header,
      rows.map(r => [
        new Date(r.created_at).toISOString(),
        r.type,
        r.status,
        r.name,
        r.phone,
        r.email,
        r.organization,
        r.district,
        r.service_category_title,
        r.services.join('; '),
        r.message,
        r.admin_note,
        r.id,
      ])
    );
  }

  private async notify(type: EnquiryType, name: string | null, message: string, services: string[]) {
    const { ENQUIRY_NOTIFY_EMAIL, ENQUIRY_NOTIFY_PHONE } = this.deps.config;
    const who = name ?? 'someone';
    const what = TYPE_LABEL[type];
    if (ENQUIRY_NOTIFY_PHONE) {
      await this.deps.queue.send('sms-send', { to: ENQUIRY_NOTIFY_PHONE, message: `Nursery Link: new ${what} from ${who}. See the Inbox in the admin console.` });
    }
    if (ENQUIRY_NOTIFY_EMAIL) {
      const lines = [`New ${what} from ${who}.`, '', ...(services.length ? [`Services: ${services.join(', ')}`, ''] : []), message, '', 'Reply and track it in the admin console Inbox.'];
      await this.deps.queue.send('email-send', { to: ENQUIRY_NOTIFY_EMAIL, subject: `Nursery Link: new ${what}`, text: lines.join('\n') });
    }
  }
}
