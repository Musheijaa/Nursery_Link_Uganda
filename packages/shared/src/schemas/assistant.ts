import { z } from 'zod';

/** Limits on one request to the assistant, so a conversation stays small on the wire and in cost. */
export const ASSISTANT_LIMITS = {
  /** Messages sent per request (the latest exchanges; older ones are dropped by the client) */
  maxMessages: 16,
  /** A person's message */
  maxUserChars: 1000,
  /** One of the assistant's earlier replies, sent back as history */
  maxAssistantChars: 4000,
} as const;

const userMessage = z.object({
  role: z.literal('user'),
  content: z.string().trim().min(1, 'Type a question first').max(ASSISTANT_LIMITS.maxUserChars, `Please keep questions under ${String(ASSISTANT_LIMITS.maxUserChars)} letters`),
});
const assistantMessage = z.object({
  role: z.literal('assistant'),
  content: z.string().trim().min(1).max(ASSISTANT_LIMITS.maxAssistantChars),
});

/**
 * One turn of a conversation with the site assistant. The server keeps no conversation: the
 * browser sends the recent history each time, and the last message is the new question.
 */
export const assistantChatSchema = z
  .object({
    messages: z.array(z.discriminatedUnion('role', [userMessage, assistantMessage])).min(1).max(ASSISTANT_LIMITS.maxMessages),
    /** The person's position, if they already shared it on the site this session (~100 m) */
    location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
    /** The page the assistant was opened on, e.g. /library/mvule */
    page: z.string().trim().max(200).regex(/^\/[^\s]*$/, 'A site path such as /nurseries').optional(),
  })
  .superRefine((body, ctx) => {
    if (body.messages.at(-1)?.role !== 'user') {
      ctx.addIssue({ code: 'custom', path: ['messages'], message: 'The last message must be the new question' });
    }
  });
export type AssistantChat = z.input<typeof assistantChatSchema>;

/** Why an answer ended. */
export const assistantStops = ['complete', 'limit', 'declined'] as const;
export type AssistantStop = (typeof assistantStops)[number];

/**
 * What the assistant streams back (server-sent events, one JSON object per `data:` line):
 * - `status`: it is looking something up (shown as "Looking up nurseries…");
 * - `text`: the next piece of the answer (Markdown);
 * - `done`: the answer is finished (`limit` = cut short, `declined` = it won't answer that);
 * - `error`: something failed part-way; the answer so far may be incomplete.
 */
export const assistantEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('status'), tool: z.string(), label: z.string() }),
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({ type: z.literal('done'), stop: z.enum(assistantStops) }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);
export type AssistantEvent = z.infer<typeof assistantEventSchema>;
