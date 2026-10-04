import { MockEmail } from '../src/providers/email/mockEmail.js';
import type { GeocodingProvider } from '../src/providers/geocoding/geocoding.js';
import { MockGeocoding } from '../src/providers/geocoding/mockGeocoding.js';
import { paymentProviders } from '../src/providers/index.js';
import { MockPayment } from '../src/providers/payment/mockPayment.js';
import { MockRouting } from '../src/providers/routing/mockRouting.js';
import type { DirectionsProvider, RoutingProvider } from '../src/providers/routing/routing.js';
import { MockSms } from '../src/providers/sms/mockSms.js';
import { ProviderUnavailableError } from '../src/lib/errors.js';

/** Mock providers whose outboxes and ledgers tests can inspect and control. */
export const mockProviders = () => {
  const payment = new MockPayment();
  const routing: RoutingProvider = new MockRouting();
  return {
    sms: new MockSms(),
    email: new MockEmail(),
    routing,
    directions: routing as DirectionsProvider,
    geocoding: new MockGeocoding() as GeocodingProvider,
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

/** A place search that is always down, for testing the fall-back to our own places. */
export class DownGeocoding implements GeocodingProvider {
  readonly name = 'nominatim' as const;
  search(): Promise<never> {
    return Promise.reject(new ProviderUnavailableError('Place search unreachable'));
  }
}
