/** Outbound and inbound SMS. Implementations: MockSms (development/tests) and AfricasTalking. */
export interface SmsProvider {
  readonly name: 'mock' | 'africastalking';
  /** Sends one SMS to an E.164 number. Throws ProviderUnavailableError if the gateway rejects it. */
  send(to: string, message: string): Promise<{ providerMessageId?: string }>;
  /** Normalises a gateway's inbound-message webhook body; returns null if it is not a message. */
  parseInbound(body: unknown): InboundSms | null;
}

export interface InboundSms {
  /** Sender, E.164 */
  from: string;
  text: string;
  providerMessageId?: string;
  receivedAt: Date;
}
