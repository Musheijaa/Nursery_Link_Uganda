import request from 'supertest';
import { pino } from 'pino';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { createApp } from '../../app.js';
import { createPool } from '../../db/client.js';
import { RecordingQueue } from '../../jobs/queue.js';
import { adminToken, bearer, newBuyer } from '../../../test/auth.js';
import { prepareTestDatabase } from '../../../test/db.js';
import { errorOf } from '../../../test/http.js';
import { mockProviders } from '../../../test/providers.js';
import { testConfig } from '../../../test/testConfig.js';
import type { ApplicationDto } from './applications.service.js';

const pool = createPool(inject('databaseUrl'));
const providers = mockProviders();
const queue = new RecordingQueue();
const app = createApp({ config: testConfig(inject('databaseUrl')), pool, logger: pino({ level: 'silent' }), providers, queue });

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed view of a response body in tests
const data = <T>(res: request.Response) => (res.body as { data: T }).data;

const RULES = [
  { key: 'lc1_letter', label: 'I have an LC1 letter', type: 'boolean', required: true },
  { key: 'land_acres', label: 'Land (acres)', type: 'number', required: true },
  { key: 'farmer_group', label: 'Farmer group', type: 'text', required: false },
];
const GOOD = { lc1_letter: true, land_acres: 2 };

let admin: Record<string, string>;
const campaignIds: string[] = [];

/** A running campaign owned by this file (removed afterwards so other files' counts hold). */
const newCampaign = async (stock: number, overrides: { is_active?: boolean; ended?: boolean } = {}) => {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO campaigns (nursery_id, title, funder_name, funder_type, purpose, sub_county_id, allocated_stock, remaining_stock,
                            eligibility_rules, starts_at, ends_at, is_active)
     SELECT n.id, 'Test campaign', 'Test Funder', 'ngo', 'Testing', n.sub_county_id, $1, $1, $2::jsonb,
            now() - interval '10 days', now() + ($3 || ' days')::interval, $4
     FROM nurseries n ORDER BY n.name LIMIT 1 RETURNING id`,
    [stock, JSON.stringify(RULES), overrides.ended ? '-1' : '30', overrides.is_active ?? true]
  );
  const id = rows[0]?.id;
  if (!id) throw new Error('campaign insert failed');
  campaignIds.push(id);
  return id;
};

const remaining = async (id: string) => (await pool.query<{ r: number }>('SELECT remaining_stock AS r FROM campaigns WHERE id = $1', [id])).rows[0]?.r;

const apply = (campaignId: string, headers: Record<string, string>, body: object = { answers: GOOD, quantity_requested: 10 }) =>
  request(app).post(`/api/v1/campaigns/${campaignId}/apply`).set(headers).send(body);

const review = (id: string, status: string, note?: string) =>
  request(app).put(`/api/v1/admin/applications/${id}`).set(admin).send({ status, ...(note ? { note } : {}) });

const buyer = async () => {
  const b = await newBuyer(app, providers.sms);
  return { headers: bearer(b.token), phone: b.phone, id: b.userId };
};

beforeAll(async () => {
  await prepareTestDatabase(pool);
  admin = bearer(await adminToken(app));
});

afterAll(async () => {
  await pool.query('DELETE FROM campaign_applications WHERE campaign_id = ANY($1::uuid[])', [campaignIds]);
  await pool.query('DELETE FROM campaigns WHERE id = ANY($1::uuid[])', [campaignIds]);
  await pool.end();
});

beforeEach(() => {
  queue.jobs.length = 0;
});

describe('POST /campaigns/:id/apply', () => {
  it('records an application with the cleaned answers', async () => {
    const id = await newCampaign(100);
    const b = await buyer();
    const res = await apply(id, b.headers, { answers: { ...GOOD, farmer_group: '  Seeta Women ' }, quantity_requested: 25 }).expect(201);
    expect(data<ApplicationDto>(res)).toMatchObject({
      status: 'pending',
      quantity_requested: 25,
      answers: { lc1_letter: true, land_acres: 2, farmer_group: 'Seeta Women' },
      campaign: { id, title: 'Test campaign' },
    });
    expect(data<ApplicationDto>(res)).not.toHaveProperty('applicant');
    // Applying reserves nothing: stock only moves on approval
    expect(await remaining(id)).toBe(100);

    const mine = data<ApplicationDto[]>(await request(app).get('/api/v1/campaigns/applications/me').set(b.headers).expect(200));
    expect(mine.map(a => a.campaign.id)).toEqual([id]);
  });

  it('allows one application per buyer per campaign', async () => {
    const id = await newCampaign(100);
    const b = await buyer();
    await apply(id, b.headers).expect(201);
    expect(errorOf(await apply(id, b.headers).expect(409)).message).toMatch(/already applied/);
  });

  it('validates answers against the eligibility rules', async () => {
    const id = await newCampaign(100);
    const b = await buyer();
    const missing = await apply(id, b.headers, { answers: { lc1_letter: true }, quantity_requested: 5 }).expect(400);
    expect(errorOf(missing).details).toEqual([{ path: 'answers.land_acres', message: 'Answer "Land (acres)"' }]);
    const ineligible = await apply(id, b.headers, { answers: { lc1_letter: false, land_acres: 1 }, quantity_requested: 5 }).expect(400);
    expect(errorOf(ineligible).details).toEqual([expect.objectContaining({ path: 'answers.lc1_letter', message: expect.stringMatching(/^Not eligible/) as string })]);
    await apply(id, b.headers, { answers: { ...GOOD, bribe: 'yes' }, quantity_requested: 5 }).expect(400);
    await apply(id, b.headers, { answers: GOOD, quantity_requested: 0 }).expect(400);
    // None of the rejected attempts counted as the buyer's one application
    await apply(id, b.headers).expect(201);
  });

  it('only accepts applications while the campaign is running with stock left', async () => {
    const b = await buyer();
    await apply(await newCampaign(100, { is_active: false }), b.headers).expect(409);
    await apply(await newCampaign(100, { ended: true }), b.headers).expect(409);
    const small = await newCampaign(5);
    expect(errorOf(await apply(small, b.headers, { answers: GOOD, quantity_requested: 6 }).expect(409)).details).toEqual({ remaining_stock: 5 });
    await apply('00000000-0000-4000-8000-000000000000', b.headers).expect(404);
  });
});

describe('admin review', () => {
  it('approval takes the seedlings from remaining stock, audits, and texts the applicant', async () => {
    const id = await newCampaign(100);
    const b = await buyer();
    const application = data<ApplicationDto>(await apply(id, b.headers, { answers: GOOD, quantity_requested: 30 }).expect(201));

    const list = data<(ApplicationDto & { applicant: { phone: string } })[]>(
      await request(app).get(`/api/v1/admin/campaigns/${id}/applications?status=pending`).set(admin).expect(200)
    );
    expect(list.map(a => [a.id, a.applicant.phone])).toEqual([[application.id, b.phone]]);

    const approved = data<ApplicationDto>(await review(application.id, 'approved', 'Letter checked').expect(200));
    expect(approved).toMatchObject({ status: 'approved' });
    expect(approved.reviewed_at).not.toBeNull();
    expect(await remaining(id)).toBe(70);

    const { rows } = await pool.query<{ action: string; actor_id: string; after: { note: string; campaign_remaining_stock: number } }>(
      `SELECT action, actor_id, after FROM audit_log WHERE entity = 'campaign_application' AND entity_id = $1`, [application.id]);
    expect(rows).toEqual([expect.objectContaining({ action: 'application.approved', after: expect.objectContaining({ note: 'Letter checked', campaign_remaining_stock: 70 }) as unknown })]);
    expect(rows[0]?.actor_id).toBeTruthy();

    const sms = queue.take('sms-send');
    expect(sms).toEqual([expect.objectContaining({ to: b.phone, message: expect.stringContaining('approved for 30 free seedlings') as string })]);

    await review(application.id, 'collected').expect(200);
    await review(application.id, 'rejected').expect(409);
    await review(application.id, 'approved').expect(409);
    expect(await remaining(id)).toBe(70);
  });

  it('rejection leaves stock alone', async () => {
    const id = await newCampaign(100);
    const application = data<ApplicationDto>(await apply(id, (await buyer()).headers).expect(201));
    await review(application.id, 'rejected').expect(200);
    expect(await remaining(id)).toBe(100);
    await review(application.id, 'approved').expect(409);
    await review(application.id, 'collected').expect(409);
  });

  it('never lets remaining stock go below zero, even with parallel approvals', async () => {
    const id = await newCampaign(50);
    const applications = await Promise.all(
      Array.from({ length: 6 }, async () => data<ApplicationDto>(await apply(id, (await buyer()).headers, { answers: GOOD, quantity_requested: 10 }).expect(201)))
    );
    const results = await Promise.all(applications.map(a => review(a.id, 'approved')));
    expect(results.filter(r => r.status === 200)).toHaveLength(5);
    const refused = results.find(r => r.status === 409);
    expect(refused && errorOf(refused).details).toEqual({ remaining_stock: 0 });
    expect(await remaining(id)).toBe(0);
  });

  it('404s for unknown applications and campaigns', async () => {
    await review('00000000-0000-4000-8000-000000000000', 'approved').expect(404);
    await request(app).get('/api/v1/admin/campaigns/00000000-0000-4000-8000-000000000000/applications').set(admin).expect(404);
  });
});

describe('RBAC', () => {
  const id = '00000000-0000-4000-8000-000000000000';

  it('visitors must sign in to apply or see applications', async () => {
    await request(app).post(`/api/v1/campaigns/${id}/apply`).send({}).expect(401);
    await request(app).get('/api/v1/campaigns/applications/me').expect(401);
    await request(app).get(`/api/v1/admin/campaigns/${id}/applications`).expect(401);
    await request(app).put(`/api/v1/admin/applications/${id}`).send({}).expect(401);
  });

  it('buyers cannot review; admins cannot apply', async () => {
    const b = await buyer();
    await request(app).get(`/api/v1/admin/campaigns/${id}/applications`).set(b.headers).expect(403);
    await request(app).put(`/api/v1/admin/applications/${id}`).set(b.headers).send({ status: 'approved' }).expect(403);
    await request(app).post(`/api/v1/campaigns/${id}/apply`).set(admin).send({ answers: GOOD, quantity_requested: 1 }).expect(403);
  });
});
