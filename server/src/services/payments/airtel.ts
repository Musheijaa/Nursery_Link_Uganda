import { config } from '../../config.js';
import { PaymentProvider, PaymentRequest, ProviderError, ProviderStatus } from './types.js';

// Airtel Money Open API: https://developers.airtel.africa
// Collections use /merchant/v1/payments; payouts use /standard/v1/disbursements.

let cachedToken: { token: string; expiresAt: number } | null = null;

const getToken = async () => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const res = await fetch(`${config.AIRTEL_BASE_URL}/auth/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: '*/*' },
    body: JSON.stringify({
      client_id: config.AIRTEL_CLIENT_ID,
      client_secret: config.AIRTEL_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new ProviderError(`Airtel token request failed (${res.status})`, body);
  cachedToken = { token: body.access_token, expiresAt: Date.now() + Number(body.expires_in ?? 180) * 1000 };
  return body.access_token as string;
};

const headers = async () => ({
  Authorization: `Bearer ${await getToken()}`,
  'Content-Type': 'application/json',
  Accept: '*/*',
  'X-Country': 'UG',
  'X-Currency': 'UGX',
});

// Airtel expects the subscriber number without the country code, and a transaction id without dashes
const msisdn = (phone: string) => phone.slice(1);
const transactionId = (reference: string) => reference.replace(/-/g, '');

const post = async (path: string, payload: unknown) => {
  const res = await fetch(`${config.AIRTEL_BASE_URL}${path}`, { method: 'POST', headers: await headers(), body: JSON.stringify(payload) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.status?.success === false) {
    throw new ProviderError(`Airtel ${path} was rejected (${res.status}): ${body?.status?.message ?? 'unknown error'}`, body);
  }
  return body;
};

const status = async (path: string, reference: string): Promise<ProviderStatus> => {
  const res = await fetch(`${config.AIRTEL_BASE_URL}${path}/${transactionId(reference)}`, { headers: await headers() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ProviderError(`Airtel status check failed (${res.status})`, body);

  const tx = body?.data?.transaction ?? {};
  switch (tx.status) {
    case 'TS':
      return { status: 'successful', providerReference: tx.airtel_money_id, raw: body };
    case 'TF':
    case 'TE':
      return { status: 'failed', reason: tx.message ?? 'Transaction failed', raw: body };
    default:
      return { status: 'pending', raw: body };
  }
};

export const airtelProvider: PaymentProvider = {
  name: 'airtel_money',

  requestPayment: async (req: PaymentRequest) => {
    const raw = await post('/merchant/v1/payments/', {
      reference: req.message.slice(0, 64),
      subscriber: { country: 'UG', currency: 'UGX', msisdn: msisdn(req.phone) },
      transaction: { amount: req.amountUGX, country: 'UG', currency: 'UGX', id: transactionId(req.reference) },
    });
    return { providerReference: transactionId(req.reference), raw };
  },

  getPaymentStatus: ref => status('/standard/v1/payments', ref),

  sendPayout: async (req: PaymentRequest) => {
    const raw = await post('/standard/v1/disbursements/', {
      payee: { msisdn: msisdn(req.phone) },
      reference: req.message.slice(0, 64),
      pin: config.AIRTEL_DISBURSEMENT_PIN_ENCRYPTED,
      transaction: { amount: req.amountUGX, id: transactionId(req.reference) },
    });
    return { providerReference: transactionId(req.reference), raw };
  },

  getPayoutStatus: ref => status('/standard/v1/disbursements', ref),
};
