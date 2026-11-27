import type { EmailProvider } from '../providers/email/email.js';
import type { SmsProvider } from '../providers/sms/sms.js';
import type { JobPayloads } from './queue.js';

/**
 * Sends one SMS. Throwing lets pg-boss retry it: 3 attempts in total, with exponential backoff
 * (see RETRY in queue.ts).
 */
export const smsSend = (sms: SmsProvider) => async ({ to, message }: JobPayloads['sms-send']) => {
  await sms.send(to, message);
};

/** Sends one email; throwing lets pg-boss retry it (see RETRY in queue.ts). */
export const emailSend = (email: EmailProvider) => async ({ to, subject, text }: JobPayloads['email-send']) => {
  await email.send({ to, subject, text });
};
