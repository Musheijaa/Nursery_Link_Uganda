import { ProviderUnavailableError } from '../../lib/errors.js';
import type { PaymentProvider, PaymentRequest, ProviderPaymentStatus, StatusResult } from './payment.js';

interface MockTransaction extends PaymentRequest {
  kind: 'collection' | 'disbursement';
  status: ProviderPaymentStatus;
  reason?: string;
}

/**
 * In-memory mobile money for development and tests.
 *  - Collections stay pending until settled (tests call settle(); in development the
 *    dev-only endpoint POST /api/v1/dev/mock-payments/:ref/settle does).
 *  - Disbursements succeed at once unless failures have been queued with failNextDisbursements().
 */
export class MockPayment implements PaymentProvider {
  readonly name = 'mock' as const;
  readonly transactions = new Map<string, MockTransaction>();
  private disbursementFailures = 0;
  private unavailable = false;

  requestToPay(req: PaymentRequest): Promise<{ providerRef: string }> {
    return this.create(req, 'collection', 'pending');
  }

  disburse(req: PaymentRequest): Promise<{ providerRef: string }> {
    if (this.disbursementFailures > 0) {
      this.disbursementFailures -= 1;
      return this.create(req, 'disbursement', 'failed', 'MOCK_PAYEE_NOT_FOUND');
    }
    return this.create(req, 'disbursement', 'successful');
  }

  getPaymentStatus(providerRef: string): Promise<StatusResult> {
    return this.status(providerRef);
  }

  getDisbursementStatus(providerRef: string): Promise<StatusResult> {
    return this.status(providerRef);
  }

  // ── Test and development controls ────────────────────────

  /** Simulates the customer approving or declining the prompt on their phone. */
  settle(providerRef: string, status: 'successful' | 'failed', reason?: string): void {
    const tx = this.transactions.get(providerRef);
    if (!tx) throw new Error(`Unknown mock transaction ${providerRef}`);
    tx.status = status;
    if (reason) tx.reason = reason;
  }

  failNextDisbursements(count: number): void {
    this.disbursementFailures = count;
  }

  /** While true, every call fails as if the provider were down. */
  setUnavailable(unavailable: boolean): void {
    this.unavailable = unavailable;
  }

  lastCollection(): MockTransaction | undefined {
    return [...this.transactions.values()].filter(t => t.kind === 'collection').at(-1);
  }

  private create(req: PaymentRequest, kind: MockTransaction['kind'], status: ProviderPaymentStatus, reason?: string) {
    if (this.unavailable) return Promise.reject(new ProviderUnavailableError('Mobile money provider unreachable'));
    // Like real providers, a repeated idempotency key returns the original transaction
    const providerRef = `mock-${req.idempotencyKey}`;
    if (!this.transactions.has(providerRef)) {
      this.transactions.set(providerRef, { ...req, kind, status, ...(reason ? { reason } : {}) });
    }
    return Promise.resolve({ providerRef });
  }

  private status(providerRef: string): Promise<StatusResult> {
    if (this.unavailable) return Promise.reject(new ProviderUnavailableError('Mobile money provider unreachable'));
    const tx = this.transactions.get(providerRef);
    if (!tx) return Promise.resolve({ status: 'failed', reason: 'NOT_FOUND' });
    return Promise.resolve({ status: tx.status, ...(tx.reason ? { reason: tx.reason } : {}), providerRef, raw: { mock: true, status: tx.status } });
  }
}
