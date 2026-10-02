import { z } from 'zod';
import { toE164UgandaMobile } from '@nurserylink/shared';
import { ProviderUnavailableError } from '../../lib/errors.js';
import type { InboundSms, SmsProvider } from './sms.js';

// Africa's Talking SMS API: https://developers.africastalking.com/docs/sms/sending/bulk
const LIVE_URL = 'https://api.africastalking.com/version1/messaging';
const SANDBOX_URL = 'https://api.sandbox.africastalking.com/version1/messaging';

const sendResponseSchema = z.object({
  SMSMessageData: z.object({
    Message: z.string(),
    Recipients: z.array(z.object({ status: z.string(), statusCode: z.number(), messageId: z.string().optional() })),
  }),
});

// Inbound messages arrive as form fields: from, to, text, date, id, linkId
const inboundSchema = z.object({ from: z.string(), text: z.string(), id: z.string().optional(), date: z.string().optional() });

export class AfricasTalkingSms implements SmsProvider {
  readonly name = 'africastalking' as const;

  constructor(
    private readonly username: string,
    private readonly apiKey: string,
    private readonly senderId?: string,
    private readonly timeoutMs = 10_000
  ) {}

  async send(to: string, message: string): Promise<{ providerMessageId?: string }> {
    const body = new URLSearchParams({ username: this.username, to, message });
    if (this.senderId) body.set('from', this.senderId);

    let res: Response;
    try {
      res = await fetch(this.username === 'sandbox' ? SANDBOX_URL : LIVE_URL, {
        method: 'POST',
        headers: { apiKey: this.apiKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new ProviderUnavailableError('SMS gateway unreachable', { cause: String(err) });
    }

    const parsed = sendResponseSchema.safeParse(await res.json().catch(() => null));
    const recipient = parsed.success ? parsed.data.SMSMessageData.Recipients[0] : undefined;
    // statusCode 100–102 mean processed/sent/queued
    if (!res.ok || !recipient || recipient.statusCode < 100 || recipient.statusCode > 102) {
      throw new ProviderUnavailableError('SMS gateway rejected the message', {
        status: res.status,
        detail: parsed.success ? parsed.data.SMSMessageData.Message : 'unexpected response',
      });
    }
    return recipient.messageId ? { providerMessageId: recipient.messageId } : {};
  }

  parseInbound(body: unknown): InboundSms | null {
    const parsed = inboundSchema.safeParse(body);
    if (!parsed.success) return null;
    const from = toE164UgandaMobile(parsed.data.from);
    if (!from) return null;
    return {
      from,
      text: parsed.data.text,
      ...(parsed.data.id ? { providerMessageId: parsed.data.id } : {}),
      receivedAt: parsed.data.date ? new Date(parsed.data.date) : new Date(),
    };
  }
}
