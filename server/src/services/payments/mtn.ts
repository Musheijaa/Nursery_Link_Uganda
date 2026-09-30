import { config } from '../../config.js';
import { toInternational } from '../../lib/phone.js';
import { PaymentProvider, PaymentRequest, ProviderError, ProviderStatus } from './types.js';

// MTN MoMo Open API: https://momodeveloper.mtn.com/api-documentation
// Collection (Request to Pay) takes buyer payments; Disbursement (Transfer) pays nurseries and refunds.

type Product = 'collection' | 'disbursement';

const credentials: Record<Product, () => { key: string; user: string; secret: string }> = {
  collection: () => ({
    key: config.MTN_COLLECTION_SUBSCRIPTION_KEY,
    user: config.MTN_COLLECTION_API_USER,
    secret: config.MTN_COLLECTION_API_KEY,
  }),
  disbursement: () => ({
    key: config.MTN_DISBURSEMENT_SUBSCRIPTION_KEY,
    user: config.MTN_DISBURSEMENT_API_USER,
    secret: config.MTN_DISBURSEMENT_API_KEY,
  }),
};

const tokenCache: Partial<Record<Product, { token: string; expiresAt: number }>> = {};

const getToken = async (product: Product) => {
  const cached = tokenCache[product];
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const { key, user, secret } = credentials[product]();
  const res = await fetch(`${config.MTN_BASE_URL}/${product}/token/`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${user}:${secret}`).toString('base64')}`,
      'Ocp-Apim-Subscription-Key': key,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new ProviderError(`MTN ${product} token request failed (${res.status})`, body);
  tokenCache[product] = { token: body.access_token, expiresAt: Date.now() + Number(body.expires_in ?? 3600) * 1000 };
  return body.access_token as string;
};

const headers = async (product: Product, extra: Record<string, string> = {}) => ({
  Authorization: `Bearer ${await getToken(product)}`,
  'X-Target-Environment': config.MTN_TARGET_ENVIRONMENT,
  'Ocp-Apim-Subscription-Key': credentials[product]().key,
  'Content-Type': 'application/json',
  ...extra,
});

const callbackHeader = (): Record<string, string> =>
  // MTN only calls back to HTTPS URLs; locally we rely on status polling instead
  config.API_PUBLIC_URL.startsWith('https://') ? { 'X-Callback-Url': `${config.API_PUBLIC_URL}/api/webhooks/mtn` } : {};

const create = async (product: Product, path: string, req: PaymentRequest, party: 'payer' | 'payee') => {
  const res = await fetch(`${config.MTN_BASE_URL}/${product}/v1_0/${path}`, {
    method: 'POST',
    headers: await headers(product, { 'X-Reference-Id': req.reference, ...callbackHeader() }),
    body: JSON.stringify({
      amount: String(req.amountUGX),
      currency: config.MTN_CURRENCY,
      externalId: req.reference,
      [party]: { partyIdType: 'MSISDN', partyId: toInternational(req.phone) },
      payerMessage: req.message,
      payeeNote: req.message,
    }),
  });
  // 202 Accepted: the request is queued and the customer is being prompted
  if (res.status !== 202) {
    throw new ProviderError(`MTN ${path} was rejected (${res.status})`, await res.text());
  }
  return { providerReference: req.reference };
};

const status = async (product: Product, path: string, reference: string): Promise<ProviderStatus> => {
  const res = await fetch(`${config.MTN_BASE_URL}/${product}/v1_0/${path}/${reference}`, { headers: await headers(product) });
  const body = await res.json().catch(() => ({}));
  if (res.status === 404) return { status: 'failed', reason: 'Payment not found at MTN', raw: body };
  if (!res.ok) throw new ProviderError(`MTN status check failed (${res.status})`, body);

  switch (body.status) {
    case 'SUCCESSFUL':
      return { status: 'successful', providerReference: body.financialTransactionId, raw: body };
    case 'FAILED':
    case 'REJECTED':
    case 'TIMEOUT':
      return { status: 'failed', reason: body.reason?.message ?? body.reason ?? body.status, raw: body };
    default:
      return { status: 'pending', raw: body };
  }
};

export const mtnProvider: PaymentProvider = {
  name: 'mtn_momo',
  requestPayment: req => create('collection', 'requesttopay', req, 'payer'),
  getPaymentStatus: ref => status('collection', 'requesttopay', ref),
  sendPayout: req => create('disbursement', 'transfer', req, 'payee'),
  getPayoutStatus: ref => status('disbursement', 'transfer', ref),
};
