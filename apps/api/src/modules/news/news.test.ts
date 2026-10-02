import { RecordingQueue } from '../../jobs/queue.js';
import request from 'supertest';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createApp } from '../../app.js';
import { createPool } from '../../db/client.js';
import { prepareTestDatabase } from '../../../test/db.js';
import { mockProviders } from '../../../test/providers.js';
import { testConfig } from '../../../test/testConfig.js';

const pool = createPool(inject('databaseUrl'));
const app = createApp({ config: testConfig(inject('databaseUrl')), pool, logger: pino({ level: 'silent' }), providers: mockProviders(), queue: new RecordingQueue() });

beforeAll(async () => {
  await prepareTestDatabase(pool);
  // A draft and a scheduled post must never appear
  await pool.query(`INSERT INTO news_posts (title, slug, category, body, is_published, published_at) VALUES
    ('Draft', 'draft-post', 'policy', 'Not ready', false, NULL),
    ('Scheduled', 'scheduled-post', 'policy', 'Later', true, now() + interval '7 days')
    ON CONFLICT (slug) DO NOTHING`);
});
afterAll(() => pool.end());

type Post = { slug: string; category: string; excerpt?: string; body?: string; published_at: string };

describe('news (FR-22)', () => {
  it('lists published posts newest first with excerpts', async () => {
    const body = (await request(app).get('/api/v1/news').expect(200)).body as { data: Post[]; meta: { total: number } };
    // Other test files add posts in parallel: check the seeded ones keep their order
    const seeded = ['nfa-seedling-price-guide', 'plant-early-in-the-second-rains', 'grafted-avocado-seedling-prices-steady', 'shoreline-restoration-seedlings-open'];
    expect(body.data.map(p => p.slug).filter(slug => seeded.includes(slug))).toEqual(seeded);
    expect(body.meta.total).toBeGreaterThanOrEqual(4);
    expect(body.data[0]).not.toHaveProperty('body');
    expect(body.data[0]?.excerpt).toMatch(/…$/);
  });

  it('filters by category', async () => {
    const body = (await request(app).get('/api/v1/news?category=grant').expect(200)).body as { data: Post[] };
    expect(body.data.map(p => p.slug)).toEqual(['shoreline-restoration-seedlings-open']);
    await request(app).get('/api/v1/news?category=sports').expect(400);
  });

  it('shows a published post in full and hides drafts and scheduled posts', async () => {
    const post = (await request(app).get('/api/v1/news/plant-early-in-the-second-rains').expect(200)).body as { data: Post };
    expect(post.data.body).toMatch(/September–November/);
    await request(app).get('/api/v1/news/draft-post').expect(404);
    await request(app).get('/api/v1/news/scheduled-post').expect(404);
  });
});
