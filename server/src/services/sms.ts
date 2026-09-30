import { config } from '../config.js';
import { toInternational } from '../lib/phone.js';

const AT_URL = config.AT_USERNAME === 'sandbox'
  ? 'https://api.sandbox.africastalking.com/version1/messaging'
  : 'https://api.africastalking.com/version1/messaging';

/**
 * Sends an SMS. In console mode the message is only logged, so development works without an account.
 * Delivery failures are logged, not thrown: an SMS problem must never roll back an order or payment.
 */
export const sendSms = async (phone: string, message: string): Promise<void> => {
  if (config.SMS_MODE === 'console') {
    if (config.NODE_ENV !== 'test') console.log(`[sms → ${phone}] ${message}`);
    return;
  }

  try {
    const body = new URLSearchParams({ username: config.AT_USERNAME, to: `+${toInternational(phone)}`, message });
    if (config.AT_SENDER_ID) body.set('from', config.AT_SENDER_ID);
    const res = await fetch(AT_URL, {
      method: 'POST',
      headers: { apiKey: config.AT_API_KEY, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) console.error(`SMS to ${phone} failed: ${res.status} ${await res.text()}`);
  } catch (err) {
    console.error(`SMS to ${phone} failed:`, err);
  }
};
