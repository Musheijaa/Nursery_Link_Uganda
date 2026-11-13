import { ApiError, toApiError } from '@nurserylink/api-client';
import { assistantEventSchema, type AssistantChat, type AssistantEvent } from '@nurserylink/shared';
import { api } from '../../lib/api';

/** The server sends a keep-alive every 15 s; this long without a byte means the connection died. */
const IDLE_MS = 45_000;

/**
 * Reads a server-sent event stream: each event is a block of lines ending in a blank line, and
 * its `data:` lines carry one JSON AssistantEvent. Comment lines (": keep-alive") are skipped.
 */
export const readEvents = async (body: ReadableStream<Uint8Array>, onEvent: (event: AssistantEvent) => void, idleMs = IDLE_MS): Promise<void> => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  // An object, so the timer's change is visible after the loop (and to the type checker)
  const watch = { stalled: false };
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      watch.stalled = true;
      void reader.cancel();
    }, idleMs);
  };

  const dispatch = (block: string) => {
    const data = block
      .split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trimStart())
      .join('\n');
    if (!data) return;
    const parsed = assistantEventSchema.safeParse(JSON.parse(data));
    if (parsed.success) onEvent(parsed.data);
    // A newer server may send kinds of event this version doesn't know: skip them, but say so
    else console.warn('Unrecognised assistant event', data);
  };

  try {
    arm();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      arm();
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? '';
      blocks.forEach(dispatch);
    }
    buffer += decoder.decode();
    if (buffer.trim()) dispatch(buffer);
  } finally {
    clearTimeout(timer);
  }
  if (watch.stalled) throw new ApiError('network_error', 'The connection dropped while answering. Try again.', 0);
};

/**
 * Asks the assistant and streams its answer through `onEvent`. Errors before the answer starts
 * (switched off, too many questions, offline) reject with an ApiError like any other request.
 */
export const streamAnswer = async (body: AssistantChat, onEvent: (event: AssistantEvent) => void, signal: AbortSignal): Promise<void> => {
  const { response, error } = await api.POST('/assistant/chat', { body, parseAs: 'stream', signal });
  // The envelope's code and message, as for every other request
  if (!response.ok || !response.body) throw toApiError(response.status, error);
  await readEvents(response.body, onEvent);
};
