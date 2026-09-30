export type ProviderName = 'simulated' | 'mtn_momo' | 'airtel_money';

export interface PaymentRequest {
  /** Our UUID for this payment; sent to the provider as the idempotency key */
  reference: string;
  amountUGX: number;
  phone: string;
  /** Short text shown to the customer on their phone */
  message: string;
}

export interface ProviderStatus {
  status: 'pending' | 'successful' | 'failed';
  reason?: string;
  providerReference?: string;
  raw?: unknown;
}

export interface PaymentProvider {
  name: ProviderName;
  /** Asks the customer to approve a payment on their phone (collection). */
  requestPayment(req: PaymentRequest): Promise<{ providerReference?: string; raw?: unknown }>;
  getPaymentStatus(reference: string): Promise<ProviderStatus>;
  /** Sends money to a phone (payout to a nursery, or a refund to a buyer). */
  sendPayout(req: PaymentRequest): Promise<{ providerReference?: string; raw?: unknown }>;
  getPayoutStatus(reference: string): Promise<ProviderStatus>;
}

export class ProviderError extends Error {
  constructor(message: string, public raw?: unknown) {
    super(message);
  }
}
