import { z } from 'zod';
import { ProviderUnavailableError } from '../../lib/errors.js';
import type { PaymentProvider, PaymentRequest, StatusResult } from './payment.js';

// MTN MoMo Open API: https://momodeveloper.mtn.com/api-documentation
// Collection (request to pay) takes money from the buyer; Disbursement (transfer) pays out.

export interface MtnProductCredentials {
  subscriptionKey: string;
  apiUser: string;
  apiKey: string;
}

export interface MtnMomoOptions {
  baseUrl: string;
  /** "sandbox" for the developer sandbox; the country environment (e.g. "mtnuganda") in production */
  targetEnvironment: string;
  /** "EUR" is the only currency the sandbox accepts; "UGX" in production */
  currency: string;
  collection: MtnProductCredentials;
  disbursement: MtnProductCredentials;
  /** Where MTN posts status callbacks; must match the API user's providerCallbackHost */
  callbackUrl?: string | undefined;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

type Product = 'collection' | 'disbursement';

const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() });
const statusSchema = z.object({
  status: z.string(),
  financialTransactionId: z.string().optional(),
  // A code string in some responses, { code, message } in others
  reason: z.union([z.string(), z.object({ code: z.string().optional(), message: z.string().optional() })]).optional(),
});

const STATUS: Record<string, StatusResult['status']> = {
  PENDING: 'pending',
  SUCCESSFUL: 'successful',
  FAILED: 'failed',
  REJECTED: 'failed',
  TIMEOUT: 'failed',
};

/** MTN wants the number without the "+": +256772123456 → 256772123456. */
const partyId = (msisdn: string) => msisdn.replace(/^\+/, '');

/**
 * MTN Mobile Money (Uganda) via the MoMo Open API.
 *
 * Our payment idempotency key (a UUID v4) is sent as X-Reference-Id, so it is also MTN's reference:
 * repeating a request after a timeout returns 409, which means "already created", never a second charge.
 * The key also goes in externalId, which MTN echoes in callbacks.
 */
export class MtnMomo implements PaymentProvider {
  readonly name = 'mtn_momo' as const;
  private readonly tokens = new Map<Product, { value: string; expiresAt: number }>();
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: MtnMomoOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  requestToPay(req: PaymentRequest): Promise<{ providerRef: string }> {
    return this.create('collection', '/collection/v1_0/requesttopay', req, {
      payer: { partyIdType: 'MSISDN', partyId: partyId(req.msisdn) },
    });
  }

  getPaymentStatus(providerRef: string): Promise<StatusResult> {
    return this.status('collection', `/collection/v1_0/requesttopay/${encodeURIComponent(providerRef)}`, providerRef);
  }

  disburse(req: PaymentRequest): Promise<{ providerRef: string }> {
    return this.create('disbursement', '/disbursement/v1_0/transfer', req, {
      payee: { partyIdType: 'MSISDN', partyId: partyId(req.msisdn) },
    });
  }

  getDisbursementStatus(providerRef: string): Promise<StatusResult> {
    return this.status('disbursement', `/disbursement/v1_0/transfer/${encodeURIComponent(providerRef)}`, providerRef);
  }

  // ── Internals ────────────────────────────────────────────

  private async create(product: Product, path: string, req: PaymentRequest, party: object): Promise<{ providerRef: string }> {
    const body = {
      amount: String(req.amount),
      currency: this.options.currency,
      externalId: req.idempotencyKey,
      ...party,
      payerMessage: req.message.slice(0, 160),
      payeeNote: req.message.slice(0, 160),
    };
    const res = await this.call(product, path, {
      method: 'POST',
      headers: {
        'X-Reference-Id': req.idempotencyKey,
        'Content-Type': 'application/json',
        ...(this.options.callbackUrl ? { 'X-Callback-Url': this.options.callbackUrl } : {}),
      },
      body: JSON.stringify(body),
    });
    // 202 = accepted; 409 = this reference already exists, i.e. an earlier attempt got through
    if (res.status === 202 || res.status === 409) return { providerRef: req.idempotencyKey };
    throw await this.failure(res, `MTN MoMo refused the ${product === 'collection' ? 'payment request' : 'transfer'}`);
  }

  private async status(product: Product, path: string, providerRef: string): Promise<StatusResult> {
    const res = await this.call(product, path, { method: 'GET' });
    if (res.status === 404) return { status: 'failed', reason: 'NOT_FOUND', providerRef };
    if (!res.ok) throw await this.failure(res, 'MTN MoMo could not report the payment status');
    const raw: unknown = await res.json().catch(() => null);
    const parsed = statusSchema.safeParse(raw);
    if (!parsed.success) throw new ProviderUnavailableError('MTN MoMo sent an unexpected status response');
    const { status, reason } = parsed.data;
    const mapped = STATUS[status.toUpperCase()];
    if (!mapped) throw new ProviderUnavailableError(`MTN MoMo reported an unknown status: ${status}`);
    const reasonText = typeof reason === 'string' ? reason : (reason?.code ?? reason?.message);
    return { status: mapped, providerRef, raw, ...(mapped === 'failed' ? { reason: reasonText ?? status } : {}) };
  }

  /** An authorised request. A 401 (expired or revoked token) gets one retry with a fresh token. */
  private async call(product: Product, path: string, init: { method: 'GET' | 'POST'; body?: string; headers?: Record<string, string> }): Promise<Response> {
    const send = async () =>
      this.fetch(`${this.base()}${path}`, {
        ...init,
        headers: {
          ...init.headers,
          Authorization: `Bearer ${await this.token(product)}`,
          'X-Target-Environment': this.options.targetEnvironment,
          'Ocp-Apim-Subscription-Key': this.options[product].subscriptionKey,
        },
      });
    const res = await send();
    if (res.status !== 401) return res;
    this.tokens.delete(product);
    return send();
  }

  /** OAuth access token per product, cached until a minute before it expires. */
  private async token(product: Product): Promise<string> {
    const cached = this.tokens.get(product);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const { apiUser, apiKey, subscriptionKey } = this.options[product];
    const res = await this.fetch(`${this.base()}/${product}/token/`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiUser}:${apiKey}`).toString('base64')}`,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      },
    });
    if (res.status === 401 || res.status === 403) {
      throw new ProviderUnavailableError(`MTN MoMo rejected the ${product} credentials`, { status: res.status });
    }
    if (!res.ok) throw await this.failure(res, 'MTN MoMo sign-in failed');
    const parsed = tokenSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) throw new ProviderUnavailableError('MTN MoMo sent an unexpected sign-in response');
    const value = parsed.data.access_token;
    this.tokens.set(product, { value, expiresAt: Date.now() + (parsed.data.expires_in - 60) * 1000 });
    return value;
  }

  private base() {
    return this.options.baseUrl.replace(/\/$/, '');
  }

  private async fetch(url: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetchImpl(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (err) {
      throw new ProviderUnavailableError('MTN MoMo is unreachable', { cause: String(err) });
    }
  }

  /** A 503 carrying MTN's error code (never our credentials) for logs and the audit trail. */
  private async failure(res: Response, message: string): Promise<ProviderUnavailableError> {
    const body: unknown = await res.json().catch(() => null);
    const code = typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string' ? body.code : undefined;
    return new ProviderUnavailableError(message, { status: res.status, ...(code ? { code } : {}) });
  }
}
