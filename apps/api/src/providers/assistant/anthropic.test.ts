import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ProviderUnavailableError } from '../../lib/errors.js';
import { AnthropicAssistant } from './anthropic.js';
import type { AssistantRequest, AssistantTool } from './assistant.js';

/** One recorded Messages API stream, as server-sent events. */
const sse = (events: object[]): string =>
  events.map(e => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join('');

const start = { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 900, output_tokens: 1, cache_read_input_tokens: 800, cache_creation_input_tokens: 0 } } };
const end = (stop: string) => [
  { type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 30 } },
  { type: 'message_stop' },
];

const toolCall = (name: string, input: object) =>
  sse([
    start,
    { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_1', name, input: {} } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) } },
    { type: 'content_block_stop', index: 0 },
    ...end('tool_use'),
  ]);

const answer = (pieces: string[], stop = 'end_turn') =>
  sse([
    start,
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    ...pieces.map(text => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })),
    { type: 'content_block_stop', index: 0 },
    ...end(stop),
  ]);

/** A fetch that answers each Messages API call with the next recorded response, and keeps the requests. */
const replay = (responses: { status?: number; body: string; headers?: Record<string, string> }[]) => {
  const requests: { headers: Headers; body: Record<string, unknown> }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push({ headers: request.headers, body: (await request.json()) as Record<string, unknown> });
    const next = responses.shift();
    if (!next) throw new Error('No more recorded responses');
    return new Response(next.body, {
      status: next.status ?? 200,
      headers: { 'content-type': next.status && next.status >= 400 ? 'application/json' : 'text/event-stream', ...next.headers },
    });
  };
  return { fetchImpl, requests };
};

const searchTrees: AssistantTool = {
  name: 'search_trees',
  label: 'Searching the tree library…',
  description: 'Search trees',
  input: z.object({ query: z.string().optional() }),
  run: () => Promise.resolve({ results: [{ name: 'Mvule', link: '/library/mvule' }] }),
};

const assistant = (fetchImpl: typeof fetch) =>
  new AnthropicAssistant({ apiKey: 'test-key', model: 'claude-opus-5-5', effort: 'low', logger: pino({ level: 'silent' }), fetch: fetchImpl, baseURL: 'http://anthropic.test' });

const request = (overrides: Partial<AssistantRequest> = {}) => {
  const text: string[] = [];
  const calls: { name: string; input: unknown }[] = [];
  const req: AssistantRequest = {
    system: 'You are the Nursery Link assistant.',
    context: 'Facts for this reply: today is Friday.',
    history: [{ role: 'user', content: 'Tell me about mvule' }],
    tools: [searchTrees],
    callTool: (name, input) => {
      calls.push({ name, input });
      return Promise.resolve({ ok: true, result: { results: [{ name: 'Mvule', link: '/library/mvule' }] } });
    },
    onText: t => { text.push(t); },
    signal: new AbortController().signal,
    ...overrides,
  };
  return { req, text, calls };
};

describe('AnthropicAssistant', () => {
  it('runs the look-ups the model asks for, then streams its answer', async () => {
    const { fetchImpl, requests } = replay([
      { body: toolCall('search_trees', { query: 'mvule' }) },
      { body: answer(['**Mvule** grows ', 'slowly. See [Mvule](/library/mvule).']) },
    ]);
    const { req, text, calls } = request();

    const result = await assistant(fetchImpl).respond(req);

    expect(result).toEqual({ stop: 'complete' });
    expect(calls).toEqual([{ name: 'search_trees', input: { query: 'mvule' } }]);
    expect(text.join('')).toBe('**Mvule** grows slowly. See [Mvule](/library/mvule).');

    const [first, second] = requests;
    if (!first || !second) throw new Error('expected two model calls');
    // Fixed instructions and tools first and cached; the per-request facts last, as a system message
    expect(first.body).toMatchObject({
      model: 'claude-opus-5-5',
      system: 'You are the Nursery Link assistant.',
      output_config: { effort: 'low' },
      cache_control: { type: 'ephemeral' },
      fallbacks: 'default',
      messages: [{ role: 'user', content: 'Tell me about mvule' }, { role: 'system', content: 'Facts for this reply: today is Friday.' }],
    });
    expect(first.body).not.toHaveProperty('thinking');
    expect(first.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(first.body.tools).toEqual([
      expect.objectContaining({ name: 'search_trees', eager_input_streaming: true, input_schema: expect.objectContaining({ type: 'object', properties: { query: { type: 'string' } } }) as unknown }),
    ]);
    // The tool's result goes back with the model's own turn, then the model answers
    const messages = second.body.messages as { role: string; content: unknown }[];
    expect(messages.slice(-2)).toEqual([
      { role: 'assistant', content: [expect.objectContaining({ type: 'tool_use', id: 'toolu_1', name: 'search_trees' })] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: JSON.stringify({ results: [{ name: 'Mvule', link: '/library/mvule' }] }) }] },
    ]);
  });

  it('passes a failed look-up back to the model as an error result', async () => {
    const { fetchImpl, requests } = replay([{ body: toolCall('search_trees', { query: 'x' }) }, { body: answer(['Sorry.']) }]);
    const { req } = request({ callTool: () => Promise.resolve({ ok: false, error: 'Not found' }) });
    await assistant(fetchImpl).respond(req);
    const messages = requests[1]?.body.messages as { content: unknown }[];
    expect(messages.at(-1)?.content).toEqual([{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'Not found', is_error: true }]);
  });

  it('keeps text from before a look-up as its own paragraph', async () => {
    const withPreamble = sse([
      start,
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Let me check.' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'toolu_1', name: 'search_trees', input: {} } },
      { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{}' } },
      { type: 'content_block_stop', index: 1 },
      ...end('tool_use'),
    ]);
    const { fetchImpl } = replay([{ body: withPreamble }, { body: answer(['Found it.']) }]);
    const { req, text } = request();
    await assistant(fetchImpl).respond(req);
    expect(text.join('')).toBe('Let me check.\n\nFound it.');
  });

  it('stops after the last allowed round without offering more look-ups', async () => {
    const { fetchImpl, requests } = replay([{ body: toolCall('search_trees', {}) }, { body: answer(['Here is what I have.']) }]);
    const { req } = request();
    const result = await new AnthropicAssistant({ apiKey: 'k', model: 'claude-opus-5-5', effort: 'low', logger: pino({ level: 'silent' }), fetch: fetchImpl, baseURL: 'http://anthropic.test', maxToolRounds: 1 }).respond(req);
    expect(result.stop).toBe('complete');
    expect(requests[1]?.body).not.toHaveProperty('tools');
  });

  it('reports a declined question, and never runs look-ups cut off by the token limit', async () => {
    const declined = replay([{ body: answer([], 'refusal') }]);
    expect(await assistant(declined.fetchImpl).respond(request().req)).toEqual({ stop: 'declined' });

    const truncated = sse([
      start,
      { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_1', name: 'search_trees', input: {} } },
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"query": "mv' } },
      { type: 'content_block_stop', index: 0 },
      ...end('max_tokens'),
    ]);
    const cut = replay([{ body: truncated }]);
    const { req, calls } = request();
    expect(await assistant(cut.fetchImpl).respond(req)).toEqual({ stop: 'limit' });
    expect(calls).toEqual([]);
  });

  it('turns provider failures into ProviderUnavailableError without the provider’s wording', async () => {
    const error = (status: number, type: string) => ({
      status,
      body: JSON.stringify({ type: 'error', error: { type, message: 'secret upstream detail' } }),
      headers: { 'retry-after-ms': '0' },
    });
    const busy = replay([error(429, 'rate_limit_error'), error(429, 'rate_limit_error'), error(429, 'rate_limit_error')]);
    const promise = assistant(busy.fetchImpl).respond(request().req);
    await expect(promise).rejects.toBeInstanceOf(ProviderUnavailableError);
    await expect(promise).rejects.toThrow(/very busy/);

    const badKey = replay([error(401, 'authentication_error')]);
    await expect(assistant(badKey.fetchImpl).respond(request().req)).rejects.toThrow('The assistant isn’t available right now.');
  });
});
