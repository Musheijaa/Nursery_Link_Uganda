export type SmsReply =
  | { kind: 'dispatched'; shortCode: string }
  | { kind: 'out_of_stock'; shortCode: string }
  | { kind: 'unrecognised' };

/**
 * Parses a nursery's reply to an order SMS: "<short code> 1" (dispatched) or "<short code> 2"
 * (out of stock). Tolerates case, extra spaces and simple punctuation typed on basic phones.
 */
export const parseSmsReply = (text: string): SmsReply => {
  const match = /^\s*([a-z0-9]{6})[\s,.:#-]+([12])\s*[.!]?\s*$/i.exec(text);
  if (!match?.[1] || !match[2]) return { kind: 'unrecognised' };
  const shortCode = match[1].toUpperCase();
  return match[2] === '1' ? { kind: 'dispatched', shortCode } : { kind: 'out_of_stock', shortCode };
};
