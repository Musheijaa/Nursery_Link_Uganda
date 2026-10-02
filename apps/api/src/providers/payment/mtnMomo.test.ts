import { describe, expect, it } from 'vitest';
import { ProviderUnavailableError } from '../../lib/errors.js';
import { MtnMomo, type MtnMomoOptions } from './mtnMomo.js';

interface Call {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

type Reply = { status: number; body?: unknown };

/**
 * A scripted MTN MoMo API: answers each request from `routes` (matched on "METHOD path-prefix")
 * and records it. Token requests always succeed unless overridden.
 */
const fakeMtn = (routes: Record<string, Reply | Reply[]>, calls: Call[] = []) =>
  ((input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const method = init.method ?? 'GET';
    const headers = Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>));
    calls.push({ method, url: url.pathname, headers, body: typeof init.body === 'string' ? JSON.parse(init.body) as unknown : undefined });
    const key = Object.keys(routes).find(k => `${method} ${url.pathname}`.startsWith(k));
    let reply: Reply = { status: 404 };
    if (key) {
      const r = routes[key];
      reply = Array.isArray(r) ? (r.shift() ?? { status: 500 }) : (r ?? { status: 500 });
    } else if (url.pathname.endsWith('/token/')) {
      reply = { status: 200, body: { access_token: `token-${String(calls.length)}`, token_type: 'access_token', expires_in: 3600 } };
    }
    return Promise.resolve(new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status }));
  }) as typeof fetch;

const options = (fetchImpl: typeof fetch, extra: Partial<MtnMomoOptions> = {}): MtnMomoOptions => ({
  baseUrl: 'https://sandbox.momodeveloper.mtn.com/',
  targetEnvironment: 'sandbox',
  currency: 'EUR',
  collection: { subscriptionKey: 'col-sub', apiUser: 'col-user', apiKey: 'col-key' },
  disbursement: { subscriptionKey: 'dis-sub', apiUser: 'dis-user', apiKey: 'dis-key' },
  fetchImpl,
  ...extra,
});

const request = { idempotencyKey: '5c3f3a2e-8b4e-4b5f-9c1a-2d3e4f5a6b7c', amount: 45000, msisdn: '+256772123456', message: 'Nursery Link order K7Q2MX' };

describe('MtnMomo', () => {
  it('requests a payment with our idempotency key as the MTN reference', async () => {
    const calls: Call[] = [];
    const mtn = new MtnMomo(options(fakeMtn({ 'POST /collection/v1_0/requesttopay': { status: 202 } }, calls), { callbackUrl: 'https://api.example.ug/cb' }));
    expect(await mtn.requestToPay(request)).toEqual({ providerRef: request.idempotencyKey });

    const [token, pay] = calls;
    expect(token).toMatchObject({ method: 'POST', url: '/collection/token/' });
    expect(token?.headers).toMatchObject({ Authorization: `Basic ${Buffer.from('col-user:col-key').toString('base64')}`, 'Ocp-Apim-Subscription-Key': 'col-sub' });
    expect(pay?.headers).toMatchObject({
      Authorization: 'Bearer token-1',
      'X-Reference-Id': request.idempotencyKey,
      'X-Target-Environment': 'sandbox',
      'X-Callback-Url': 'https://api.example.ug/cb',
      'Ocp-Apim-Subscription-Key': 'col-sub',
    });
    expect(pay?.body).toEqual({
      amount: '45000', currency: 'EUR', externalId: request.idempotencyKey,
      payer: { partyIdType: 'MSISDN', partyId: '256772123456' },
      payerMessage: 'Nursery Link order K7Q2MX', payeeNote: 'Nursery Link order K7Q2MX',
    });
  });

  it('treats 409 (reference already used) as the earlier request having gone through', async () => {
    const mtn = new MtnMomo(options(fakeMtn({ 'POST /collection/v1_0/requesttopay': { status: 409, body: { code: 'RESOURCE_ALREADY_EXIST' } } })));
    expect(await mtn.requestToPay(request)).toEqual({ providerRef: request.idempotencyKey });
  });

  it('reuses the access token until it expires', async () => {
    const calls: Call[] = [];
    const mtn = new MtnMomo(options(fakeMtn({ 'GET /collection/v1_0/requesttopay/': { status: 200, body: { status: 'PENDING' } } }, calls)));
    await mtn.getPaymentStatus('ref-1');
    await mtn.getPaymentStatus('ref-2');
    expect(calls.filter(c => c.url.endsWith('/token/'))).toHaveLength(1);
  });

  it('gets a fresh token once when MTN answers 401', async () => {
    const calls: Call[] = [];
    const mtn = new MtnMomo(options(fakeMtn({
      'GET /collection/v1_0/requesttopay/': [{ status: 401 }, { status: 200, body: { status: 'SUCCESSFUL', financialTransactionId: '123' } }],
    }, calls)));
    expect(await mtn.getPaymentStatus('ref')).toMatchObject({ status: 'successful', providerRef: 'ref' });
    expect(calls.filter(c => c.url.endsWith('/token/'))).toHaveLength(2);
  });

  it.each([
    [{ status: 'PENDING' }, { status: 'pending' }],
    [{ status: 'SUCCESSFUL', financialTransactionId: '9' }, { status: 'successful' }],
    [{ status: 'FAILED', reason: 'APPROVAL_REJECTED' }, { status: 'failed', reason: 'APPROVAL_REJECTED' }],
    [{ status: 'FAILED', reason: { code: 'PAYER_NOT_FOUND', message: 'Payer not found' } }, { status: 'failed', reason: 'PAYER_NOT_FOUND' }],
    [{ status: 'TIMEOUT' }, { status: 'failed', reason: 'TIMEOUT' }],
  ])('maps MTN status %j', async (body, expected) => {
    const mtn = new MtnMomo(options(fakeMtn({ 'GET /collection/v1_0/requesttopay/': { status: 200, body } })));
    expect(await mtn.getPaymentStatus('ref')).toMatchObject(expected);
  });

  it('reports an unknown reference as failed', async () => {
    const mtn = new MtnMomo(options(fakeMtn({ 'GET /collection/v1_0/requesttopay/': { status: 404, body: { code: 'RESOURCE_NOT_FOUND' } } })));
    expect(await mtn.getPaymentStatus('ref')).toEqual({ status: 'failed', reason: 'NOT_FOUND', providerRef: 'ref' });
  });

  it('pays out through the disbursement product with its own credentials', async () => {
    const calls: Call[] = [];
    const mtn = new MtnMomo(options(fakeMtn({
      'POST /disbursement/v1_0/transfer': { status: 202 },
      'GET /disbursement/v1_0/transfer/': { status: 200, body: { status: 'SUCCESSFUL' } },
    }, calls)));
    await mtn.disburse({ ...request, msisdn: '+256700100101' });
    expect(await mtn.getDisbursementStatus(request.idempotencyKey)).toMatchObject({ status: 'successful' });
    expect(calls[0]).toMatchObject({ url: '/disbursement/token/', headers: { 'Ocp-Apim-Subscription-Key': 'dis-sub' } });
    expect(calls[1]?.body).toMatchObject({ payee: { partyIdType: 'MSISDN', partyId: '256700100101' } });
    expect(calls[1]?.headers).not.toHaveProperty('X-Callback-Url');
  });

  it('fails with 503 (never leaking credentials) on bad credentials, MTN errors and network failures', async () => {
    const badCreds = new MtnMomo(options(fakeMtn({ 'POST /collection/token/': { status: 401 } })));
    const rejected = new MtnMomo(options(fakeMtn({ 'POST /collection/v1_0/requesttopay': { status: 400, body: { code: 'INVALID_CALLBACK_URL_HOST' } } })));
    const down = new MtnMomo(options(() => Promise.reject(new Error('ECONNRESET'))));

    const error = await badCreds.requestToPay(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderUnavailableError);
    expect(JSON.stringify(error)).not.toContain('col-key');
    await expect(rejected.requestToPay(request)).rejects.toMatchObject({ details: { status: 400, code: 'INVALID_CALLBACK_URL_HOST' } });
    await expect(down.getPaymentStatus('ref')).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});

/**
 * Optional check against the real MTN sandbox. Runs only when sandbox credentials are exported
 * (see scripts/mtn/sandbox-user.sh), so the normal test run never calls MTN.
 */
const sandbox = process.env.MTN_SANDBOX_TEST === '1' ? describe : describe.skip;
sandbox('MtnMomo against the MTN sandbox', () => {
  const env = (key: string) => {
    const value = process.env[key];
    if (!value) throw new Error(`${key} is required for the sandbox test`);
    return value;
  };

  it('requests a payment and reads its status', async () => {
    const mtn = new MtnMomo({
      baseUrl: 'https://sandbox.momodeveloper.mtn.com',
      targetEnvironment: 'sandbox',
      currency: 'EUR',
      collection: { subscriptionKey: env('MTN_COLLECTION_SUBSCRIPTION_KEY'), apiUser: env('MTN_COLLECTION_API_USER'), apiKey: env('MTN_COLLECTION_API_KEY') },
      disbursement: { subscriptionKey: env('MTN_DISBURSEMENT_SUBSCRIPTION_KEY'), apiUser: env('MTN_DISBURSEMENT_API_USER'), apiKey: env('MTN_DISBURSEMENT_API_KEY') },
    });
    const { providerRef } = await mtn.requestToPay({ ...request, idempotencyKey: crypto.randomUUID(), amount: 100 });
    const status = await mtn.getPaymentStatus(providerRef);
    expect(['pending', 'successful']).toContain(status.status);
  });
});
