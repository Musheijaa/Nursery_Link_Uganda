/** Transactional email. Implementations: MockEmail (logs) and SmtpEmail. */
export interface EmailProvider {
  readonly name: 'mock' | 'smtp';
  send(message: EmailMessage): Promise<void>;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}
