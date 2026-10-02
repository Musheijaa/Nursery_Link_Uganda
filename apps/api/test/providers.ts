import { MockEmail } from '../src/providers/email/mockEmail.js';
import { paymentProviders } from '../src/providers/index.js';
import { MockPayment } from '../src/providers/payment/mockPayment.js';
import { MockRouting } from '../src/providers/routing/mockRouting.js';
import type { RoutingProvider } from '../src/providers/routing/routing.js';
import { MockSms } from '../src/providers/sms/mockSms.js';
import { ProviderUnavailableError } from '../src/lib/errors.js';

/** Mock providers whose outboxes and ledgers tests can inspect and control. */
export const mockProviders = () => {
  const payment = new MockPayment();
  return {
    sms: new MockSms(),
    email: new MockEmail(),
    routing: new MockRouting() as RoutingProvider,
    payment,
    payments: paymentProviders('mock', payment),
  };
};

/** A routing provider that is always down, for testing straight-line fallbacks. */
export class DownRouting implements RoutingProvider {
  readonly name = 'osrm' as const;
  route(): Promise<never> {
    return Promise.reject(new ProviderUnavailableError('Routing service unreachable'));
  }
  table(): Promise<never> {
    return Promise.reject(new ProviderUnavailableError('Routing service unreachable'));
  }
  isochrone(): Promise<never> {
    return Promise.reject(new ProviderUnavailableError('Routing service unreachable'));
  }
}
