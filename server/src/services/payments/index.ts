import { isSimulatedPayments } from '../../config.js';
import type { PaymentNetwork } from '../../lib/phone.js';
import { airtelProvider } from './airtel.js';
import { mtnProvider } from './mtn.js';
import { simulatedProvider } from './simulated.js';
import type { PaymentProvider, ProviderName } from './types.js';

export const providerForNetwork = (network: PaymentNetwork): PaymentProvider => {
  if (isSimulatedPayments) return simulatedProvider;
  return network === 'MTN MoMo' ? mtnProvider : airtelProvider;
};

export const providerByName = (name: ProviderName): PaymentProvider =>
  ({ simulated: simulatedProvider, mtn_momo: mtnProvider, airtel_money: airtelProvider })[name];

export * from './types.js';
