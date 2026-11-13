import request from 'supertest';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { assistantEventSchema, type AssistantEvent, type HealthDto } from '@nurserylink/shared';
import { createApp } from '../../app.js';
import { createPool } from '../../db/client.js';
import { RecordingQueue } from '../../jobs/queue.js';
import type { AssistantProvider } from '../../providers/assistant/assistant.js';
import { bearer, newBuyer } from '../../../test/auth.js';
import { prepareTestDatabase } from '../../../test/db.js';
import { dataOf, errorOf } from '../../../test/http.js';
import { mockProviders } from '../../../test/providers.js';
import { testConfig } from '../../../test/testConfig.js';

const pool = createPool(inject('databaseUrl'));
const logger = pino({ level: 'silent' });
const providers = mockProviders();
const build = (env: NodeJS.ProcessEnv = {}, assistant: AssistantProvider | null = providers.assistant) =>
  createApp({ config: testConfig(inject('databaseUrl'), env), pool, logger, providers: { ...providers, assistant }, queue: new RecordingQueue() });
const app = build();

/** Every event in a server-sent event stream, checked against the shared schema. */
const events = (text: string): AssistantEvent[] =>
  text
    .split('\n\n')
    .flatMap(block => block.split('\n').filter(line => line.startsWith('data: ')))
    .map(line => assistantEventSchema.parse(JSON.parse(line.slice(6))));

/** ask() reads every response as text; errors before streaming are ordinary JSON envelopes */
const streamError = (res: request.Response) => (JSON.parse(res.body as string) as { error: { code: string; message: string } }).error;

const answerText = (list: AssistantEvent[]) => list.flatMap(e => (e.type === 'text' ? [e.text] : [])).join('');

const ask = (question: string, extra: object = {}, headers: Record<string, string> = {}, target = app) =>
  request(target)
    .post('/api/v1/assistant/chat')
    .set(headers)
    .send({ messages: [{ role: 'user', content: question }], ...extra })
    .buffer(true)
    .parse((res, done) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => { body += chunk; });
      res.on('end', () => { done(null, body); });
    });

beforeAll(async () => {
  await prepareTestDatabase(pool);
});

afterAll(async () => {
  await pool.end();
});

describe('POST /assistant/chat', () => {
  it('streams an answer built from the live catalogue', async () => {
    const res = await ask('Where can I buy mvule seedlings?', { page: '/library/mvule' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/event-stream/);
    expect(res.headers['cache-control']).toBe('no-store, no-transform');
    expect(res.headers['content-encoding']).toBeUndefined();

    const list = events(res.body as string);
    expect(list[0]).toEqual({ type: 'status', tool: 'search_nurseries', label: 'Looking up nurseries…' });
    expect(list.at(-1)).toEqual({ type: 'done', stop: 'complete' });
    // Links point at nurseries on this site
    expect(answerText(list)).toMatch(/\]\(\/nurseries\?nursery=[0-9a-f-]{36}\)/);
  });

  it('answers planting-time questions from the shared calendar', async () => {
    const list = events((await ask('When should I plant trees?')).body as string);
    expect(list[0]).toMatchObject({ type: 'status', tool: 'planting_calendar' });
    expect(answerText(list)).toMatch(/It is \w+, (the rainy season|the last month of the rains|a dry month)|rains usually start/);
  });

  it('looks up free-seedling campaigns and the tree library', async () => {
    const free = events((await ask('Are there free seedlings?')).body as string);
    expect(free[0]).toMatchObject({ type: 'status', tool: 'list_free_seedling_campaigns' });
    expect(answerText(free)).toMatch(/\/free-seedlings\/[0-9a-f-]{36}/);

    const tree = events((await ask('Tell me about mvule')).body as string);
    expect(tree[0]).toMatchObject({ type: 'status', tool: 'search_trees' });
    expect(answerText(tree)).toContain('[Mvule](/library/mvule)');
  });

  it('reads a signed-in buyer’s own orders, and never offers that to visitors', async () => {
    const buyer = await newBuyer(app, providers.sms);
    const mine = events((await ask('What is the status of my order?', {}, bearer(buyer.token))).body as string);
    expect(mine[0]).toMatchObject({ type: 'status', tool: 'my_orders' });
    expect(mine.at(-1)).toEqual({ type: 'done', stop: 'complete' });

    const visitor = events((await ask('What is the status of my order?')).body as string);
    expect(visitor.some(e => e.type === 'status' && e.tool === 'my_orders')).toBe(false);
  });

  it('rejects a conversation that doesn’t end with a question, or is too long', async () => {
    const res = await request(app)
      .post('/api/v1/assistant/chat')
      .send({ messages: [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello!' }] })
      .expect(400);
    expect(errorOf(res).code).toBe('validation_error');

    await request(app).post('/api/v1/assistant/chat').send({ messages: [{ role: 'user', content: 'x'.repeat(1001) }] }).expect(400);
    await request(app).post('/api/v1/assistant/chat').send({ messages: [{ role: 'user', content: 'Hi' }], page: 'https://evil.example' }).expect(400);
  });

  it('says so plainly when switched off, and /health tells the apps', async () => {
    const off = build({ ASSISTANT_PROVIDER: 'off' }, null);
    const res = await ask('Hello', {}, {}, off);
    expect(res.status).toBe(503);
    expect(streamError(res).code).toBe('provider_unavailable');

    const health = dataOf(await request(off).get('/api/v1/health').expect(200)) as HealthDto;
    expect(health.features.assistant).toBe(false);
    expect(health.providers.assistant).toBe('off');
    expect((dataOf(await request(app).get('/api/v1/health').expect(200)) as HealthDto).features.assistant).toBe(true);
  });

  it('stops answering for the day at the daily limit', async () => {
    const capped = build({ ASSISTANT_DAILY_LIMIT: '1' });
    expect((await ask('When to plant?', {}, {}, capped)).status).toBe(200);
    const res = await ask('When to plant?', {}, {}, capped);
    expect(res.status).toBe(429);
    expect(streamError(res).message).toMatch(/tomorrow/);
  });

  it('streams an error event when the model fails part-way', async () => {
    const failing: AssistantProvider = {
      name: 'mock',
      respond: async req => {
        req.onText('Partial');
        await Promise.resolve();
        throw new Error('model crashed');
      },
    };
    const list = events((await ask('Hello', {}, {}, build({}, failing))).body as string);
    expect(list).toEqual([
      { type: 'text', text: 'Partial' },
      { type: 'error', code: 'internal_error', message: 'Something went wrong while answering. Please try again.' },
    ]);
  });
});
