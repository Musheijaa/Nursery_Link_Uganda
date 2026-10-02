import request from 'supertest';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createApp } from '../../app.js';
import { createPool } from '../../db/client.js';
import { RecordingQueue } from '../../jobs/queue.js';
import { prepareTestDatabase } from '../../../test/db.js';
import { mockProviders } from '../../../test/providers.js';
import { testConfig } from '../../../test/testConfig.js';

const pool = createPool(inject('databaseUrl'));
const build = (env: NodeJS.ProcessEnv = {}) =>
  createApp({ config: testConfig(inject('databaseUrl'), env), pool, logger: pino({ level: 'silent' }), providers: mockProviders(), queue: new RecordingQueue() });

beforeAll(() => prepareTestDatabase(pool));
afterAll(() => pool.end());

describe('dev helpers', () => {
  it('shows texts sent to a number by the mock SMS provider, newest first', async () => {
    const app = build();
    await request(app).post('/api/v1/auth/register').send({ full_name: 'Outbox Test', phone: '0751999001', password: 'outbox-password-1' }).expect(201);
    const res = await request(app).get('/api/v1/dev/sms-outbox?to=0751999001').expect(200);
    const [latest] = (res.body as { data: { message: string; sent_at: string }[] }).data;
    expect(latest?.message).toMatch(/verification code is \d{6}/);
    await request(app).get('/api/v1/dev/sms-outbox?to=not-a-phone').expect(400);
  });

  it('is never mounted in production', async () => {
    const prod = build({ NODE_ENV: 'production' });
    await request(prod).get('/api/v1/dev/sms-outbox?to=0751999001').expect(404);
    await request(prod).post('/api/v1/dev/mock-payments/settle').send({}).expect(404);
  });
});
