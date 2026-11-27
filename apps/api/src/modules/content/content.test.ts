import request from 'supertest';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createApp } from '../../app.js';
import { createPool } from '../../db/client.js';
import { RecordingQueue } from '../../jobs/queue.js';
import { prepareTestDatabase } from '../../../test/db.js';
import { adminToken, bearer, newBuyer } from '../../../test/auth.js';
import { errorOf } from '../../../test/http.js';
import { mockProviders } from '../../../test/providers.js';
import { testConfig } from '../../../test/testConfig.js';

const pool = createPool(inject('databaseUrl'));
const providers = mockProviders();
const queue = new RecordingQueue();
const config = testConfig(inject('databaseUrl'), { ENQUIRY_NOTIFY_EMAIL: 'team@example.org', ENQUIRY_NOTIFY_PHONE: '0772999111' });
const app = createApp({ config, pool, logger: pino({ level: 'silent' }), providers, queue });

let admin: Record<string, string>;

beforeAll(async () => {
  await prepareTestDatabase(pool);
  admin = bearer(await adminToken(app));
});
afterAll(() => pool.end());

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed view of a response body in tests
const data = <T>(res: request.Response) => (res.body as { data: T }).data;

const lastAudit = async (entity: string, entityId: string) =>
  (
    await pool.query<{ action: string; before: unknown; after: unknown }>(
      'SELECT action, before, after FROM audit_log WHERE entity = $1 AND entity_id = $2 ORDER BY id DESC LIMIT 1',
      [entity, entityId]
    )
  ).rows[0];

type ServiceCategory = { id: string; slug: string; title: string; services: { id: string; title: string }[] };
type Enquiry = { id: string; type: string; status: string; name: string | null; phone: string | null; services: string[]; admin_note: string | null; service_category: { title: string } | null };

const contact = { name: 'Test Enquirer', phone: '0772555001', message: 'We would like help planning a woodlot on 5 acres.', consent: true } as const;

describe('Expert Services (public)', () => {
  it('lists the six categories from the brief with their services, in order', async () => {
    const list = data<ServiceCategory[]>(await request(app).get('/api/v1/expert-services').expect(200));
    expect(list.map(c => c.title)).toEqual([
      'Forestry, Plantations and Agroforestry',
      'Agriculture, Farm Advisory and Extension',
      'GIS, Remote Sensing, Mapping and UAV',
      'Environment, Biodiversity and Landscape Restoration',
      'Research, Monitoring, Evaluation and Technical Reporting',
      'Consultancy, Project Design and Implementation',
    ]);
    expect(list[0]?.services[0]?.title).toBe('Tree nursery establishment and management');
  });
});

describe('enquiries (Expert Services and Donate forms → admin Inbox)', () => {
  it('takes a service request without an account, keeps the service names, and tells the team', async () => {
    const [category] = data<ServiceCategory[]>(await request(app).get('/api/v1/expert-services').expect(200));
    if (!category) throw new Error('No service categories');
    queue.take('sms-send');
    queue.take('email-send');
    const res = await request(app).post('/api/v1/enquiries').send({
      type: 'service',
      ...contact,
      district: 'Mukono',
      service_category_id: category.id,
      service_ids: [category.services[2]?.id, category.services[0]?.id],
    }).expect(201);
    const { id } = data<{ id: string }>(res);

    const saved = data<Enquiry>(await request(app).get(`/api/v1/admin/enquiries/${id}`).set(admin).expect(200));
    expect(saved).toMatchObject({
      type: 'service',
      status: 'new',
      phone: '+256772555001',
      service_category: { title: category.title },
      // In the category's order, whatever order they were sent in
      services: [category.services[0]?.title, category.services[2]?.title],
    });
    expect(queue.take('sms-send')).toEqual([{ to: '+256772999111', message: expect.stringContaining('expert service request from Test Enquirer') as string }]);
    expect(queue.take('email-send')).toEqual([expect.objectContaining({ to: 'team@example.org', subject: 'Nursery Link: new expert service request' })]);
  });

  it('refuses services from another category, missing consent, and a donation with no way to reply', async () => {
    const [first, second] = data<ServiceCategory[]>(await request(app).get('/api/v1/expert-services').expect(200));
    if (!first || !second) throw new Error('No service categories');
    const wrong = await request(app).post('/api/v1/enquiries').send({
      type: 'service', ...contact, district: 'Mukono', service_category_id: first.id, service_ids: [second.services[0]?.id],
    }).expect(400);
    expect(errorOf(wrong).message).toMatch(/not offered/);
    await request(app).post('/api/v1/enquiries').send({ type: 'contact', ...contact, consent: false }).expect(400);
    await request(app).post('/api/v1/enquiries').send({ type: 'donation', name: 'No Contact', message: 'I would like to donate seedlings.', consent: true }).expect(400);
  });

  it('pretends to accept spam (the hidden field is filled in) but saves nothing', async () => {
    const before = (await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM enquiries WHERE name = 'Spam Bot'")).rows[0]?.n;
    await request(app).post('/api/v1/enquiries').send({ type: 'contact', ...contact, name: 'Spam Bot', website: 'http://spam.example' }).expect(201);
    const after = (await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM enquiries WHERE name = 'Spam Bot'")).rows[0]?.n;
    expect(after).toBe(before);
  });

  it('puts feedback in the same inbox, linked to the account when signed in', async () => {
    const buyer = await newBuyer(app, providers.sms);
    const res = await request(app).post('/api/v1/feedback').set(bearer(buyer.token))
      .send({ kind: 'suggestion', message: 'Please add more fruit trees to the list.', page: '/library' }).expect(201);
    const saved = data<Enquiry & { details: Record<string, unknown> }>(await request(app).get(`/api/v1/admin/enquiries/${data<{ id: string }>(res).id}`).set(admin).expect(200));
    expect(saved).toMatchObject({ type: 'feedback', name: 'Test Buyer', phone: buyer.phone, details: { kind: 'suggestion', page: '/library' } });
  });

  it('lets admins filter, move and note an enquiry (audited), count unread ones and export CSV', async () => {
    const created = data<{ id: string }>(await request(app).post('/api/v1/enquiries').send({ type: 'partnership', ...contact, name: 'Partner Org Test', organization: 'Green Partners' }).expect(201));
    const counts = data<{ new_by_type: { partnership: number }; new_total: number }>(await request(app).get('/api/v1/admin/enquiries/counts').set(admin).expect(200));
    expect(counts.new_by_type.partnership).toBeGreaterThanOrEqual(1);

    const listed = data<Enquiry[]>(await request(app).get('/api/v1/admin/enquiries?type=partnership&status=new&q=Green%20Partners').set(admin).expect(200));
    expect(listed.map(e => e.id)).toContain(created.id);

    const moved = data<Enquiry>(await request(app).put(`/api/v1/admin/enquiries/${created.id}`).set(admin).send({ status: 'in_progress', note: 'Called them back' }).expect(200));
    expect(moved).toMatchObject({ status: 'in_progress', admin_note: 'Called them back' });
    expect(await lastAudit('enquiry', created.id)).toMatchObject({ action: 'enquiry.in_progress', before: { status: 'new' }, after: { status: 'in_progress' } });

    const csv = await request(app).get('/api/v1/admin/export/enquiries.csv?type=partnership').set(admin).expect(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text.startsWith('﻿created_at,type,status')).toBe(true);
    expect(csv.text).toContain('Partner Org Test');

    await request(app).get('/api/v1/admin/enquiries').expect(401);
  });
});

describe('partners and page content', () => {
  it('shows only active partners publicly; admins manage them (audited)', async () => {
    const created = data<{ id: string }>(
      await request(app).post('/api/v1/admin/partners').set(admin).send({ name: 'Test Partner', logo_url: '/media/test-960.webp', website_url: 'https://example.org' }).expect(201)
    );
    try {
      expect(data<{ name: string }[]>(await request(app).get('/api/v1/partners').expect(200)).map(p => p.name)).toContain('Test Partner');
      await request(app).patch(`/api/v1/admin/partners/${created.id}`).set(admin).send({ is_active: false }).expect(200);
      expect(data<{ name: string }[]>(await request(app).get('/api/v1/partners').expect(200)).map(p => p.name)).not.toContain('Test Partner');
      expect(await lastAudit('partner', created.id)).toMatchObject({ action: 'partner.update', after: { is_active: false } });
      await request(app).post('/api/v1/admin/partners').set(admin).send({ name: 'Bad Logo', logo_url: 'javascript:alert(1)' }).expect(400);
    } finally {
      await request(app).delete(`/api/v1/admin/partners/${created.id}`).set(admin).expect(204);
    }
  });

  it('serves the client copy word for word, and checks structured fields when admins edit them', async () => {
    const blocks = data<{ key: string; title: string | null; subtitle: string | null }[]>(await request(app).get('/api/v1/page-content').expect(200));
    expect(blocks.find(b => b.key === 'home.hero')).toMatchObject({ title: 'Welcome to Nursery Link Uganda!', subtitle: 'Your Link to Quality Seedlings.' });
    expect(blocks.find(b => b.key === 'library.intro')?.title).toBe('WELCOME TO THE DIGITAL TREE LIBRARY');

    await request(app).put('/api/v1/admin/page-content/site.contact').set(admin).send({ data: { phone: 'not a phone', email: null, whatsapp: null } }).expect(400);
    await request(app).put('/api/v1/admin/page-content/no.such.key').set(admin).send({ title: 'x' }).expect(400);
    const saved = data<{ data: { phone: string } }>(
      await request(app).put('/api/v1/admin/page-content/site.contact').set(admin).send({ data: { phone: '0772000777', email: 'Team@Example.org', whatsapp: null } }).expect(200)
    );
    expect(saved.data).toEqual({ phone: '+256772000777', email: 'team@example.org', whatsapp: null });
    expect(await lastAudit('page_content', 'site.contact')).toMatchObject({ action: 'page_content.update' });
  });
});

describe('expert services (admin)', () => {
  it('creates a category, replaces its services as a list (keeping ids by title), and deletes it', async () => {
    const created = data<ServiceCategory>(
      await request(app).post('/api/v1/admin/expert-services').set(admin)
        .send({ title: 'Test Service Area', intro: 'Testing, including:', services: [{ title: 'First' }, { title: 'Second' }] }).expect(201)
    );
    expect(created).toMatchObject({ slug: 'test-service-area', services: [{ title: 'First' }, { title: 'Second' }] });
    const secondId = created.services[1]?.id;
    const updated = data<ServiceCategory>(
      await request(app).patch(`/api/v1/admin/expert-services/${created.id}`).set(admin).send({ services: [{ title: 'Second' }, { title: 'Third' }] }).expect(200)
    );
    expect(updated.services.map(s => s.title)).toEqual(['Second', 'Third']);
    expect(updated.services[0]?.id).toBe(secondId);
    await request(app).delete(`/api/v1/admin/expert-services/${created.id}`).set(admin).expect(204);
  });
});

describe('categories', () => {
  it('lists the nine tree categories publicly, in order, with tree counts', async () => {
    const list = data<{ slug: string; label: string; species_count: number }[]>(await request(app).get('/api/v1/tree-categories').expect(200));
    expect(list.map(c => c.label)).toEqual([
      'Agroforestry Species', 'Fruit Trees', 'Timber Trees', 'Medicinal Trees', 'Ornamental Trees',
      'Indigenous and Native Trees', 'Shade Trees', 'Multipurpose Trees', 'Other Species',
    ]);
    expect(list.every(c => c.species_count > 0)).toBe(true);
  });

  it('lets admins add, rename and delete an unused category, but not delete one in use', async () => {
    const created = data<{ slug: string }>(await request(app).post('/api/v1/admin/tree-categories').set(admin).send({ label: 'Test Bamboo', sort_order: 50 }).expect(201));
    expect(created.slug).toBe('test-bamboo');
    await request(app).patch('/api/v1/admin/tree-categories/test-bamboo').set(admin).send({ label: 'Test Bamboos' }).expect(200);
    await request(app).delete('/api/v1/admin/tree-categories/test-bamboo').set(admin).expect(204);
    const inUse = await request(app).delete('/api/v1/admin/tree-categories/fruit').set(admin).expect(409);
    expect(errorOf(inUse).message).toMatch(/Switch it off instead/);
    await request(app).delete('/api/v1/admin/news-categories/weather-seasonal').set(admin).expect(409);
  });
});

describe('global search', () => {
  it('groups nurseries, trees, services, news and giveaways, typo-tolerant, with links', async () => {
    const results = data<Record<string, { title: string; link: string }[]>>(await request(app).get('/api/v1/search?q=mvulle').expect(200));
    expect(results.species?.[0]).toMatchObject({ title: 'Mvule', link: '/library/mvule' });
    // Nurseries stocking Mvule match too
    expect(results.nurseries?.length).toBeGreaterThan(0);
    expect(results.nurseries?.[0]?.link).toMatch(/^\/nurseries\?nursery=/);

    const drone = data<Record<string, { title: string; link: string }[]>>(await request(app).get('/api/v1/search?q=drone').expect(200));
    expect(drone.services?.[0]).toMatchObject({ title: 'GIS, Remote Sensing, Mapping and UAV', link: '/expert-services#gis-remote-sensing-mapping-uav' });

    const shoreline = data<Record<string, { title: string; link: string }[]>>(await request(app).get('/api/v1/search?q=shoreline').expect(200));
    expect(shoreline.giveaways?.[0]?.link).toMatch(/^\/giveaways\//);
    expect(shoreline.news?.[0]?.link).toBe('/news/shoreline-restoration-seedlings-open');

    await request(app).get('/api/v1/search?q=a').expect(400);
  });
});

describe('giveaways', () => {
  it('runs a subsidised giveaway outside the platform: no pickup nursery, organizer contacts, deadline status', async () => {
    const soon = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const res = await request(app).post('/api/v1/admin/campaigns').set(admin).send({
      title: 'Test Subsidised Coffee Seedlings',
      funder_name: 'Test Coffee Authority',
      funder_type: 'government',
      purpose: 'Coffee farmers',
      offer_type: 'subsidised',
      subsidised_price: 300,
      accepts_platform_applications: false,
      application_procedure: 'Register at the sub-county office.',
      application_deadline: soon,
      contact_phone: '0772000888',
      contact_email: 'Info@Example.org',
      distribution_locations: 'Sub-county headquarters',
      starts_at: new Date(Date.now() - 86_400_000).toISOString(),
      ends_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    }).expect(201);
    const created = data<{ id: string }>(res);
    try {
      const pub = data<Record<string, unknown>>(await request(app).get(`/api/v1/giveaways/${created.id}`).expect(200));
      expect(pub).toMatchObject({
        offer_type: 'subsidised',
        subsidised_price: 300,
        accepts_platform_applications: false,
        is_open: false,
        status: 'closing_soon',
        pickup_nursery: null,
        sub_county: null,
        contact: { phone: '+256772000888', email: 'info@example.org', website: null },
        closes_at: new Date(soon).toISOString(),
      });
      const closingSoon = data<{ id: string }[]>(await request(app).get('/api/v1/giveaways?status=closing_soon').expect(200));
      expect(closingSoon.map(c => c.id)).toContain(created.id);
      const open = data<{ id: string }[]>(await request(app).get('/api/v1/giveaways').expect(200));
      expect(open.map(c => c.id)).toContain(created.id);
      const closed = data<{ id: string }[]>(await request(app).get('/api/v1/giveaways?status=closed').expect(200));
      expect(closed.map(c => c.id)).not.toContain(created.id);
      // Nobody can apply on the site
      const buyer = await newBuyer(app, providers.sms);
      await request(app).post(`/api/v1/giveaways/${created.id}/apply`).set(bearer(buyer.token)).send({ answers: {}, quantity_requested: 1 }).expect(409);
    } finally {
      await request(app).delete(`/api/v1/admin/campaigns/${created.id}`).set(admin).expect(204);
    }
  });

  it('refuses a subsidised giveaway with no price, and platform applications with no pickup nursery', async () => {
    const base = {
      title: 'Bad giveaway', funder_name: 'X', funder_type: 'ngo', purpose: 'Y',
      starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 86_400_000).toISOString(),
    };
    await request(app).post('/api/v1/admin/campaigns').set(admin).send({ ...base, offer_type: 'subsidised', accepts_platform_applications: false }).expect(400);
    await request(app).post('/api/v1/admin/campaigns').set(admin).send({ ...base, accepts_platform_applications: true }).expect(400);
  });
});

describe('online ordering switch', () => {
  it('refuses quotes and orders with FEATURE_ORDERS=off and reports it in /health', async () => {
    const off = createApp({ config: testConfig(inject('databaseUrl'), { FEATURE_ORDERS: 'off' }), pool, logger: pino({ level: 'silent' }), providers, queue: new RecordingQueue() });
    const buyer = await newBuyer(off, providers.sms);
    const health = data<{ features: { orders: boolean } }>(await request(off).get('/api/v1/health').expect(200));
    expect(health.features.orders).toBe(false);
    const nursery = (await pool.query<{ id: string; inventory_id: string }>(
      `SELECT n.id, i.id AS inventory_id FROM nurseries n JOIN inventory i ON i.nursery_id = n.id WHERE n.is_active AND NOT n.is_demo AND i.quantity_available > 0 LIMIT 1`
    )).rows[0];
    if (!nursery) throw new Error('No stocked nursery');
    const res = await request(off).post('/api/v1/orders/quote').set(bearer(buyer.token))
      .send({ nursery_id: nursery.id, items: [{ inventory_id: nursery.inventory_id, quantity: 1 }], delivery_type: 'self_pickup' }).expect(403);
    expect(errorOf(res).message).toMatch(/Call or WhatsApp the nursery operator/);
  });
});
