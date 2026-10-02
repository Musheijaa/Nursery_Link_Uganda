import type { Logger } from 'pino';
import type { InboundSms, SmsProvider } from './sms.js';

export interface SentSms {
  to: string;
  message: string;
  at: Date;
}

/** Records messages instead of sending them. Tests read `outbox`; development prints them to the log. */
export class MockSms implements SmsProvider {
  readonly name = 'mock' as const;
  readonly outbox: SentSms[] = [];

  constructor(private readonly logger?: Logger) {}

  send(to: string, message: string): Promise<{ providerMessageId?: string }> {
    this.outbox.push({ to, message, at: new Date() });
    this.logger?.info({ to, sms: message }, 'MockSms: message not sent (mock provider)');
    return Promise.resolve({ providerMessageId: `mock-${String(this.outbox.length)}` });
  }

  /** Accepts `{ from, text }` so tests and local tools can simulate replies. */
  parseInbound(body: unknown): InboundSms | null {
    if (typeof body !== 'object' || body === null) return null;
    const { from, text } = body as Record<string, unknown>;
    if (typeof from !== 'string' || typeof text !== 'string') return null;
    return { from, text, receivedAt: new Date() };
  }

  lastTo(to: string): SentSms | undefined {
    return this.outbox.filter(m => m.to === to).at(-1);
  }
}
