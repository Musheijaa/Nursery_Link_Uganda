import nodemailer, { type Transporter } from 'nodemailer';
import { ProviderUnavailableError } from '../../lib/errors.js';
import type { EmailMessage, EmailProvider } from './email.js';

export class SmtpEmail implements EmailProvider {
  readonly name = 'smtp' as const;
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(options: { host: string; port: number; user: string; password: string; from: string }) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.port === 465,
      auth: { user: options.user, pass: options.password },
      connectionTimeout: 10_000,
    });
    this.from = options.from;
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, ...message });
    } catch (err) {
      throw new ProviderUnavailableError('Email could not be sent', { cause: String(err) });
    }
  }
}
