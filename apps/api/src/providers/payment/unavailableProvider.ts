import type { PaymentProviderName } from '@nurserylink/shared';
import { ProviderUnavailableError } from '../../lib/errors.js';
import type { PaymentProvider, StatusResult } from './payment.js';

/**
 * Placeholder for a live provider that is not built yet. MTN MoMo (sandbox, then production) arrives
 * in Phase 8; Airtel Money stays a stub until its credentials are available. Every call fails
 * loudly with 503, so live mode can never silently pretend to move money.
 */
export class NotYetAvailablePayment implements PaymentProvider {
  constructor(readonly name: Exclude<PaymentProviderName, 'mock'>) {}

  private fail(): Promise<never> {
    return Promise.reject(new ProviderUnavailableError(`${this.name} payments are not available yet`));
  }

  requestToPay(): Promise<{ providerRef: string }> {
    return this.fail();
  }
  getPaymentStatus(): Promise<StatusResult> {
    return this.fail();
  }
  disburse(): Promise<{ providerRef: string }> {
    return this.fail();
  }
  getDisbursementStatus(): Promise<StatusResult> {
    return this.fail();
  }
}
