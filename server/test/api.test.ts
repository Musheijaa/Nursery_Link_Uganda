import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { pool, prepareDatabase } from '../src/db/pool.js';
import { SAMPLE_OWNER_PASSWORD } from '../src/db/seed.js';

let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  await prepareDatabase();
  app = createApp();
});

afterAll(async () => {
  await pool.end();
});

// ── Helpers ────────────────────────────────────────────────

const SEETA_OWNER = '0700100102'; // Seeta Fruit & Tree Seedlings (Mukono)
const KASANGALABI_OWNER = '0700100101';

const buyer = async (phone: string, name = 'Test Buyer') => {
  const agent = request.agent(app);
  const otp = await agent.post('/api/auth/otp/request').send({ phone }).expect(200);
  expect(otp.body.devCode).toMatch(/^\d{6}$/);
  await agent.post('/api/auth/otp/verify').send({ phone, code: otp.body.devCode, name }).expect(200);
  return agent;
};

const owner = async (phone: string) => {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ phone, password: SAMPLE_OWNER_PASSWORD }).expect(200);
  return agent;
};

const admin = async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ phone: process.env.ADMIN_PHONE, password: process.env.ADMIN_PASSWORD }).expect(200);
  return agent;
};

const nurseryBySlug = async (slug: string) => (await request(app).get(`/api/nurseries/${slug}`).expect(200)).body;

const batchFor = (nursery: { batches: { id: string; speciesId: string; quantityAvailable: number }[] }, speciesId: string) =>
  nursery.batches.find(b => b.speciesId === speciesId)!;

const orderBody = (nurseryId: string, batchId: string, quantity: number, extra: Record<string, unknown> = {}) => ({
  nurseryId,
  items: [{ batchId, quantity }],
  deliveryMethod: 'Boda boda',
  deliveryDistrict: 'Mukono',
  deliveryArea: 'Namilyango',
  deliveryLandmark: 'Near the trading centre',
  buyerName: 'Test Buyer',
  paymentNetwork: 'MTN MoMo',
  paymentPhone: '0772000001',
  ...extra,
});

// ── Public API ─────────────────────────────────────────────

describe('public catalogue', () => {
  it('lists nurseries sorted by distance and filtered by species', async () => {
    const res = await request(app).get('/api/nurseries?species=shea&near=Gulu').expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].district).toBe('Gulu');
    expect(res.body.every((n: { batches: { speciesId: string }[] }) => n.batches.some(b => b.speciesId === 'shea'))).toBe(true);
    const distances = res.body.map((n: { distanceKm: number }) => n.distanceKm);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('quotes delivery and refuses boda boda over long distances', async () => {
    const seeta = await nurseryBySlug('seeta-fruit');
    const near = await request(app).get(`/api/nurseries/${seeta.id}/delivery-quotes?district=Mukono&seedlings=50`).expect(200);
    expect(near.body.find((q: { method: string }) => q.method === 'Boda boda').available).toBe(true);
    const far = await request(app).get(`/api/nurseries/${seeta.id}/delivery-quotes?district=Arua&seedlings=50`).expect(200);
    expect(far.body.find((q: { method: string }) => q.method === 'Boda boda').available).toBe(false);
  });

  it('returns JSON errors for bad input and unknown routes', async () => {
    await request(app).get('/api/nurseries/does-not-exist').expect(404);
    const res = await request(app).get('/api/nope').expect(404);
    expect(res.body.error.code).toBe('not_found');
  });
});

// ── Sign-in ────────────────────────────────────────────────

describe('authentication', () => {
  it('rejects a wrong SMS code and accepts the right one', async () => {
    const agent = request.agent(app);
    const { body } = await agent.post('/api/auth/otp/request').send({ phone: '0772 111 222' }).expect(200);
    const wrong = body.devCode === '000000' ? '111111' : '000000';
    await agent.post('/api/auth/otp/verify').send({ phone: '0772111222', code: wrong }).expect(400);
    await agent.post('/api/auth/otp/verify').send({ phone: '+256772111222', code: body.devCode }).expect(200);
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user).toMatchObject({ phone: '0772111222', role: 'buyer' });
  });

  it('rejects invalid phone numbers', async () => {
    const res = await request(app).post('/api/auth/otp/request').send({ phone: '12345' }).expect(400);
    expect(res.body.error.message).toMatch(/Ugandan mobile/);
  });

  it('makes nursery owners use their password instead of an SMS code', async () => {
    const agent = request.agent(app);
    const { body } = await agent.post('/api/auth/otp/request').send({ phone: SEETA_OWNER }).expect(200);
    const res = await agent.post('/api/auth/otp/verify').send({ phone: SEETA_OWNER, code: body.devCode }).expect(400);
    expect(res.body.error.code).toBe('use_password');
    await request(app).post('/api/auth/login').send({ phone: SEETA_OWNER, password: 'wrong-password' }).expect(401);
  });

  it('logs out', async () => {
    const agent = await buyer('0772333444');
    await agent.post('/api/auth/logout').expect(200);
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
  });
});

// ── Orders and payments ────────────────────────────────────

describe('order lifecycle', () => {
  it('reserves stock, takes payment, and pays the nursery after delivery is confirmed', async () => {
    const seeta = await nurseryBySlug('seeta-fruit');
    const avocado = batchFor(seeta, 'avocado');
    const alice = await buyer('0772000001', 'Alice Namusoke');

    const created = await alice.post('/api/orders').send(orderBody(seeta.id, avocado.id, 10)).expect(201);
    const order = created.body;
    expect(order.status).toBe('awaiting_payment');
    expect(order.totalUGX).toBe(10 * 6000 + order.deliveryFeeUGX);
    expect(order.deliveryCode).toBeUndefined();
    expect(batchFor(await nurseryBySlug('seeta-fruit'), 'avocado').quantityAvailable).toBe(avocado.quantityAvailable - 10);

    const paid = await alice.post(`/api/orders/${order.id}/simulate-payment`).send({ outcome: 'approve' }).expect(200);
    expect(paid.body.status).toBe('payment_held');
    expect(paid.body.deliveryCode).toMatch(/^\d{4}$/);

    // The nursery sees the order but never the buyer's delivery code
    const nursery = await owner(SEETA_OWNER);
    const open = await nursery.get(`/api/my/nurseries/${seeta.id}/orders`).expect(200);
    const seen = open.body.find((o: { id: string }) => o.id === order.id);
    expect(seen).toBeDefined();
    expect(seen.deliveryCode).toBeUndefined();

    await nursery.post(`/api/my/orders/${order.id}/advance`).send({ to: 'on_the_way' }).expect(409); // must prepare first
    await nursery.post(`/api/my/orders/${order.id}/advance`).send({ to: 'being_prepared' }).expect(200);
    await nursery.post(`/api/my/orders/${order.id}/advance`).send({ to: 'on_the_way' }).expect(200);

    const wrongCode = paid.body.deliveryCode === '0000' ? '1111' : '0000';
    const rejected = await nursery.post(`/api/my/orders/${order.id}/confirm-delivery`).send({ code: wrongCode }).expect(400);
    expect(rejected.body.error.code).toBe('wrong_delivery_code');

    const delivered = await nursery.post(`/api/my/orders/${order.id}/confirm-delivery`).send({ code: paid.body.deliveryCode }).expect(200);
    expect(delivered.body.status).toBe('delivered');
    expect(delivered.body.payout).toMatchObject({ status: 'successful', amountUGX: order.totalUGX });

    // Order history is recorded
    const final = await alice.get(`/api/orders/${order.id}`).expect(200);
    expect(final.body.events.map((e: { status: string }) => e.status)).toEqual([
      'awaiting_payment', 'payment_held', 'being_prepared', 'on_the_way', 'delivered',
    ]);
  });

  it('returns reserved stock when the buyer declines the payment', async () => {
    const seeta = await nurseryBySlug('seeta-fruit');
    const mango = batchFor(seeta, 'mango');
    const bob = await buyer('0772000002');
    const { body: order } = await bob.post('/api/orders').send(orderBody(seeta.id, mango.id, 5)).expect(201);
    const declined = await bob.post(`/api/orders/${order.id}/simulate-payment`).send({ outcome: 'decline' }).expect(200);
    expect(declined.body.status).toBe('payment_failed');
    expect(batchFor(await nurseryBySlug('seeta-fruit'), 'mango').quantityAvailable).toBe(mango.quantityAvailable);
  });

  it('never oversells when two buyers order the last seedlings at once', async () => {
    const seeta = await nurseryBySlug('seeta-fruit');
    const mutuba = batchFor(seeta, 'mutuba');
    // Leave exactly 10 in stock, then race two orders of 8
    const nursery = await owner(SEETA_OWNER);
    await nursery.patch(`/api/my/batches/${mutuba.id}`).send({ quantityAvailable: 10 }).expect(200);

    const [a, b] = await Promise.all([buyer('0772000003'), buyer('0772000004')]);
    const results = await Promise.all([
      a.post('/api/orders').send(orderBody(seeta.id, mutuba.id, 8)),
      b.post('/api/orders').send(orderBody(seeta.id, mutuba.id, 8)),
    ]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect(batchFor(await nurseryBySlug('seeta-fruit'), 'mutuba').quantityAvailable).toBe(2);
  });

  it('refuses delivery methods the nursery does not offer or that do not fit the order', async () => {
    const seeta = await nurseryBySlug('seeta-fruit');
    const avocado = batchFor(seeta, 'avocado');
    const carol = await buyer('0772000005');
    await carol.post('/api/orders').send(orderBody(seeta.id, avocado.id, 5, { deliveryMethod: 'Truck' })).expect(400);
    const tooFar = await carol.post('/api/orders').send(orderBody(seeta.id, avocado.id, 5, { deliveryDistrict: 'Arua' })).expect(400);
    expect(tooFar.body.error.message).toMatch(/40 km/);
  });

  it('lets a buyer report a problem and an admin refund it', async () => {
    const seeta = await nurseryBySlug('seeta-fruit');
    const jack = batchFor(seeta, 'jackfruit');
    const dan = await buyer('0772000006');
    const { body: order } = await dan.post('/api/orders').send(orderBody(seeta.id, jack.id, 4)).expect(201);
    await dan.post(`/api/orders/${order.id}/simulate-payment`).send({ outcome: 'approve' }).expect(200);
    await dan.post(`/api/orders/${order.id}/report-problem`).send({ note: 'Seedlings arrived wilted' }).expect(200);

    const adminAgent = await admin();
    const disputes = await adminAgent.get('/api/admin/orders?status=problem_reported').expect(200);
    expect(disputes.body.some((o: { id: string }) => o.id === order.id)).toBe(true);

    const resolved = await adminAgent.post(`/api/admin/orders/${order.id}/resolve`).send({ action: 'refund', note: 'Photos confirmed damage' }).expect(200);
    expect(resolved.body.status).toBe('cancelled');
    expect(resolved.body.payout.status).toBe('successful');
    expect(batchFor(await nurseryBySlug('seeta-fruit'), 'jackfruit').quantityAvailable).toBe(jack.quantityAvailable);
  });
});

// ── Access control ─────────────────────────────────────────

describe('access control', () => {
  it('keeps orders private to their buyer and nursery', async () => {
    const seeta = await nurseryBySlug('seeta-fruit');
    const erin = await buyer('0772000007');
    const { body: order } = await erin.post('/api/orders').send(orderBody(seeta.id, batchFor(seeta, 'avocado').id, 2)).expect(201);

    const frank = await buyer('0772000008');
    await frank.get(`/api/orders/${order.id}`).expect(403);
    await frank.post(`/api/orders/${order.id}/confirm-delivery`).expect(403);

    const otherNursery = await owner(KASANGALABI_OWNER);
    await otherNursery.post(`/api/my/orders/${order.id}/advance`).send({ to: 'being_prepared' }).expect(403);
    await otherNursery.get(`/api/my/nurseries/${seeta.id}/orders`).expect(403);
  });

  it('blocks buyers from nursery tools and non-admins from admin tools', async () => {
    const agent = await buyer('0772000009');
    await agent.get('/api/my/nurseries').expect(403);
    await agent.get('/api/admin/overview').expect(403);
    await (await owner(SEETA_OWNER)).get('/api/admin/overview').expect(403);
    await request(app).get('/api/orders').expect(401);
  });
});

// ── Free seedling programmes ───────────────────────────────

describe('programmes', () => {
  it('issues one voucher per phone and enforces district and quantity rules', async () => {
    const grace = await buyer('0772000010', 'Grace Akello');
    await grace.post('/api/programmes/northern-shea-fruit/apply').send({ name: 'Grace Akello', district: 'Mukono', seedlings: 10 }).expect(400);
    await grace.post('/api/programmes/northern-shea-fruit/apply').send({ name: 'Grace Akello', district: 'Gulu', seedlings: 51 }).expect(400);

    const { body: voucher } = await grace.post('/api/programmes/northern-shea-fruit/apply').send({ name: 'Grace Akello', district: 'Gulu', seedlings: 50 }).expect(201);
    expect(voucher.code).toMatch(/^NLV-\d{3}-\d{3}$/);

    const again = await grace.post('/api/programmes/northern-shea-fruit/apply').send({ name: 'Grace Akello', district: 'Gulu', seedlings: 10 }).expect(409);
    expect(again.body.error.code).toBe('already_applied');

    await grace.post('/api/programmes/elgon-slopes/apply').send({ name: 'Grace Akello', district: 'Mbale', seedlings: 10 }).expect(400); // not open yet

    // Only a partner nursery can redeem it, and only once
    const laroo = await nurseryBySlug('laroo-farmers');
    const kasangalabi = await nurseryBySlug('kasangalabi');
    await (await owner(KASANGALABI_OWNER)).post(`/api/my/nurseries/${kasangalabi.id}/vouchers/redeem`).send({ code: voucher.code }).expect(403);
    const larooOwner = await owner('0700100108');
    await larooOwner.post(`/api/my/nurseries/${laroo.id}/vouchers/redeem`).send({ code: voucher.code }).expect(200);
    await larooOwner.post(`/api/my/nurseries/${laroo.id}/vouchers/redeem`).send({ code: voucher.code }).expect(409);
  });
});

// ── Nursery sign-up ────────────────────────────────────────

describe('nursery registration', () => {
  it('registers a nursery that stays hidden until an admin approves it', async () => {
    const agent = await buyer('0752000011', 'Peter Ocen');
    const registration = {
      name: 'Aboke Tree Growers',
      operatorName: 'Peter Ocen',
      district: 'Lira',
      subCounty: 'Aboke',
      village: 'Aboke Trading Centre',
      registration: 'Community group',
      registrationNumber: 'LIR/CBO/2025/0042',
      established: 2021,
      description: 'Community nursery raising mango, shea and woodlot seedlings for Kole and Lira.',
      openingHours: 'Mon–Sat, 8:00am–5:00pm',
      deliveryMethods: ['Collect from nursery', 'Boda boda'],
      password: 'short',
    };
    await agent.post('/api/auth/register-nursery').send(registration).expect(400);
    const { body } = await agent.post('/api/auth/register-nursery').send({ ...registration, password: 'aboke-trees-2025' }).expect(201);
    expect(body.nursery.status).toBe('pending');

    const listed = async () => (await request(app).get('/api/nurseries?district=Lira').expect(200)).body.map((n: { id: string }) => n.id);
    expect(await listed()).not.toContain(body.nursery.id);

    // The owner can already manage stock and sign in with the new password
    const mine = await agent.get('/api/my/nurseries').expect(200);
    expect(mine.body[0].status).toBe('pending');
    await agent.post(`/api/my/nurseries/${body.nursery.id}/batches`).send({
      speciesId: 'mango', seedlingType: 'Grafted', ageMonths: 9, heightCm: 50, unitPriceUGX: 4500, quantityAvailable: 800,
    }).expect(201);
    await request(app).post('/api/auth/login').send({ phone: '0752000011', password: 'aboke-trees-2025' }).expect(200);

    const adminAgent = await admin();
    const pending = await adminAgent.get('/api/admin/nurseries?status=pending').expect(200);
    expect(pending.body.map((n: { id: string }) => n.id)).toContain(body.nursery.id);
    await adminAgent.post(`/api/admin/nurseries/${body.nursery.id}/status`).send({ status: 'active' }).expect(200);
    expect(await listed()).toContain(body.nursery.id);
  });
});
