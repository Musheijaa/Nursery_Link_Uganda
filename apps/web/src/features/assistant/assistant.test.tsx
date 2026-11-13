import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AssistantEvent } from '@nurserylink/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, server } from '../../test/msw';
import { renderRoute } from '../../test/render';
import AssistantPanel from './AssistantPanel';
import { historyFor, reset, type Turn } from './conversation';
import { readEvents } from './stream';

const encoder = new TextEncoder();
const streamOf = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
const sse = (events: AssistantEvent[]) => events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('');

const health = (assistant: 'mock' | 'anthropic') => {
  server.use(
    http.get('/health', ({ response }) =>
      response(200).json({
        data: {
          status: 'ok', db: 'ok', version: 'test', commit: null,
          providers: { payment: 'mock', sms: 'mock', routing: 'mock', directions: 'mock', email: 'mock', assistant },
          payment_methods: { mtn_momo: true, airtel_money: true },
          features: { phone_verification: true, payments: true, assistant: true },
          site: { demo_notice: false, survey_url: null },
        },
      })
    )
  );
};

describe('readEvents', () => {
  it('reads events split across chunks and skips keep-alive comments', async () => {
    const seen: AssistantEvent[] = [];
    await readEvents(
      streamOf(['data: {"type":"status","tool":"search_trees","label":"Searching…"}\n', '\n: keep-alive\n\ndata: {"type":"text",', '"text":"Mvule"}\n\ndata: {"type":"done","stop":"complete"}\n\n']),
      e => { seen.push(e); }
    );
    expect(seen).toEqual([
      { type: 'status', tool: 'search_trees', label: 'Searching…' },
      { type: 'text', text: 'Mvule' },
      { type: 'done', stop: 'complete' },
    ]);
  });

  it('gives up on a stream that goes silent', async () => {
    const silent = new ReadableStream<Uint8Array>({ start() { /* never sends anything */ } });
    await expect(readEvents(silent, () => undefined, 20)).rejects.toThrow(/connection dropped/);
  });
});

describe('historyFor', () => {
  const turn = (role: Turn['role'], text: string, state: Turn['state'] = 'done'): Turn => ({ id: text, role, text, state });

  it('sends the recent exchanges, leaving out failed answers', () => {
    expect(historyFor([turn('user', 'Hi'), turn('assistant', 'Sorry', 'error'), turn('user', 'Mvule?')])).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'user', content: 'Mvule?' },
    ]);
  });

  it('keeps within the server’s limits and starts with a question', () => {
    const many = Array.from({ length: 20 }, (_, i) => turn(i % 2 ? 'assistant' : 'user', `m${String(i)}`)).concat(turn('user', 'last'));
    const history = historyFor(many);
    expect(history.length).toBeLessThanOrEqual(16);
    expect(history[0]?.role).toBe('user');
    expect(history.at(-1)).toEqual({ role: 'user', content: 'last' });
  });
});

describe('AssistantPanel', () => {
  beforeEach(() => { reset(); sessionStorage.clear(); });
  afterEach(() => { reset(); });

  it('streams an answer with its look-up status, and site links navigate and close the panel', async () => {
    health('anthropic');
    let sent: unknown;
    server.use(
      http.post('/assistant/chat', async ({ request, response }) => {
        sent = await request.json();
        return response(200).text(
          sse([
            { type: 'status', tool: 'search_nurseries', label: 'Looking up nurseries…' },
            { type: 'text', text: '**Kiwanga Tree Nursery** has Mvule: ' },
            { type: 'text', text: '[see its stock](/nurseries?nursery=abc).' },
            { type: 'done', stop: 'complete' },
          ]),
          { headers: { 'Content-Type': 'text/event-stream' } }
        );
      })
    );
    const onOpenChange = vi.fn();
    renderRoute(<AssistantPanel open onOpenChange={onOpenChange} />, { path: '/library/:slug', at: '/library/mvule' });

    const dialog = await screen.findByRole('dialog', { name: 'Ask Nursery Link' });
    expect(screen.getByRole('textbox', { name: 'Your question' })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Which nurseries near me sell Mvule?' }));

    const link = await within(dialog).findByRole('link', { name: 'see its stock' });
    expect(within(dialog).getByText('Kiwanga Tree Nursery')).toBeInTheDocument();
    expect(sent).toEqual({ messages: [{ role: 'user', content: 'Which nurseries near me sell Mvule?' }], page: '/library/mvule' });
    await waitFor(() => { expect(screen.getByText(/^Answer ready:/)).toBeInTheDocument(); });

    await userEvent.click(link);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('labels test mode, and offers to try again after an error', async () => {
    health('mock');
    let calls = 0;
    server.use(
      http.post('/assistant/chat', ({ response }) => {
        calls++;
        return calls === 1
          ? response(503).json({ error: { code: 'provider_unavailable', message: 'The assistant couldn’t answer just now. Please try again.' } })
          : response(200).text(sse([{ type: 'text', text: 'Plant in March.' }, { type: 'done', stop: 'complete' }]), { headers: { 'Content-Type': 'text/event-stream' } });
      })
    );
    renderRoute(<AssistantPanel open onOpenChange={() => undefined} />);
    expect(await screen.findByText(/Test mode: no AI is connected/)).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: 'Your question' }), 'When to plant?{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('The assistant couldn’t answer just now.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Plant in March.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('opens links to other websites in a new tab and drops unsafe ones', async () => {
    health('anthropic');
    server.use(
      http.post('/assistant/chat', ({ response }) =>
        response(200).text(
          sse([{ type: 'text', text: '[NFA](https://www.nfa.go.ug) and [bad](javascript:alert(1))' }, { type: 'done', stop: 'complete' }]),
          { headers: { 'Content-Type': 'text/event-stream' } }
        )
      )
    );
    renderRoute(<AssistantPanel open onOpenChange={() => undefined} />);
    await userEvent.type(await screen.findByRole('textbox', { name: 'Your question' }), 'Who is NFA?{Enter}');
    const nfa = await screen.findByRole('link', { name: 'NFA' });
    expect(nfa).toHaveAttribute('target', '_blank');
    expect(nfa).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByRole('link', { name: 'bad' })).not.toBeInTheDocument();
  });
});
