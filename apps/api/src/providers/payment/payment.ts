import type { PaymentProviderName } from '@nurserylink/shared';

export type ProviderPaymentStatus = 'pending' | 'successful' | 'failed';

export interface PaymentRequest {
  /** Our idempotency key (payments.idempotency_key); providers must treat repeats as the same request */
  idempotencyKey: string;
  /** Whole Uganda shillings */
  amount: number;
  /** E.164 mobile number to charge or pay */
  msisdn: string;
  /** Short text shown to the customer, e.g. "Nursery Link order K7Q2MX" */
  message: string;
}

export interface StatusResult {
  status: ProviderPaymentStatus;
  /** Provider's reason when failed, e.g. "PAYER_NOT_FOUND" */
  reason?: string;
  /** The provider's own reference, if it assigned one */
  providerRef?: string;
  raw?: unknown;
}

/**
 * Mobile-money collections (buyer → escrow) and disbursements (escrow → nursery, or refunds).
 * Implementations: MockPayment, MtnMomo, AirtelMoney. Every method throws ProviderUnavailableError
 * when the provider cannot be reached or rejects the request outright.
 */
export interface PaymentProvider {
  readonly name: PaymentProviderName;
  requestToPay(req: PaymentRequest): Promise<{ providerRef: string }>;
  getPaymentStatus(providerRef: string): Promise<StatusResult>;
  disburse(req: PaymentRequest): Promise<{ providerRef: string }>;
  getDisbursementStatus(providerRef: string): Promise<StatusResult>;
}
