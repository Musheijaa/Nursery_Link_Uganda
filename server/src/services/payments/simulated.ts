import type { PaymentProvider } from './types.js';

/**
 * Development provider. Collections stay pending until approved through the dev endpoint
 * (the "Simulate approval" button on the site); payouts succeed immediately.
 */
export const simulatedProvider: PaymentProvider = {
  name: 'simulated',
  requestPayment: async () => ({}),
  getPaymentStatus: async () => ({ status: 'pending' }),
  sendPayout: async () => ({}),
  getPayoutStatus: async () => ({ status: 'successful' }),
};
