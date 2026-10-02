import type { Logger } from 'pino';
import type { EmailMessage, EmailProvider } from './email.js';

/** Records emails instead of sending them; logs them in development. */
export class MockEmail implements EmailProvider {
  readonly name = 'mock' as const;
  readonly outbox: (EmailMessage & { at: Date })[] = [];

  constructor(private readonly logger?: Logger) {}

  send(message: EmailMessage): Promise<void> {
    this.outbox.push({ ...message, at: new Date() });
    this.logger?.info({ to: message.to, subject: message.subject, text: message.text }, 'MockEmail: message not sent (mock provider)');
    return Promise.resolve();
  }

  lastTo(to: string) {
    return this.outbox.filter(m => m.to === to).at(-1);
  }
}
