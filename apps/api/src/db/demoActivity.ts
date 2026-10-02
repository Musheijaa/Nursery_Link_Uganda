import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { parseConfig } from '../config.js';
import { createPool } from './client.js';

/**
 * DEVELOPMENT ONLY: a year of invented marketplace activity, so the admin Insights charts can be
 * built and shown before real orders exist. Refuses to run in production.
 *
 * - Buyers are named "Demo buyer N" on placeholder numbers (+256 772 99x xxx) and cannot sign in.
 * - Orders follow Uganda's planting calendar: more in the rainy seasons (March to May, September to
 *   November) and growing over the year. Each has a matching successful collection payment, and
 *   valid totals; refunded and cancelled orders are mixed in.
 * - Stock is not reduced: these are past orders. Running it again replaces the previous demo data.
 * - Writes a `demo.load` audit entry, so the data's origin is on record.
 */
const DEMO_PREFIX = 'Demo buyer';
const DEMO_PHONE = (i: number) => `+25677299${String(1000 + i).slice(-4)}`;
const SHORT = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Deterministic random numbers (mulberry32), so every run builds the same year. */
const random = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const loadDemoActivity = async (pool: pg.Pool): Promise<{ buyers: number; orders: number }> => {
  const rand = random(20261001);
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rand() * xs.length)] as T;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Replace any earlier demo data (payments first: they restrict order deletion)
    await client.query(`DELETE FROM payments WHERE order_id IN (SELECT o.id FROM orders o JOIN users u ON u.id = o.user_id WHERE u.full_name LIKE $1)`, [`${DEMO_PREFIX} %`]);
    await client.query(`DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE full_name LIKE $1)`, [`${DEMO_PREFIX} %`]);
    await client.query(`DELETE FROM users WHERE full_name LIKE $1`, [`${DEMO_PREFIX} %`]);

    const BUYERS = 24;
    const buyerIds: string[] = [];
    for (let i = 1; i <= BUYERS; i++) {
      const daysAgo = Math.floor(rand() * 360);
      const { rows } = await client.query<{ id: string }>(
        // "!" is not an argon2 hash, so demo buyers can never sign in
        `INSERT INTO users (full_name, phone, password_hash, role, phone_verified, created_at)
         VALUES ($1, $2, '!', 'buyer', true, now() - make_interval(days => $3)) RETURNING id`,
        [`${DEMO_PREFIX} ${String(i)}`, DEMO_PHONE(i), daysAgo]
      );
      if (rows[0]) buyerIds.push(rows[0].id);
    }

    const { rows: stock } = await client.query<{ id: string; nursery_id: string; species_id: string; unit_price: number; lat: number; lng: number }>(
      `SELECT i.id, i.nursery_id, i.species_id, i.unit_price, ST_Y(n.location) AS lat, ST_X(n.location) AS lng
       FROM inventory i JOIN nurseries n ON n.id = i.nursery_id WHERE n.is_active ORDER BY i.id`
    );
    const byNursery = new Map<string, typeof stock>();
    for (const s of stock) byNursery.set(s.nursery_id, [...(byNursery.get(s.nursery_id) ?? []), s]);
    const nurseries = [...byNursery.keys()];
    // A few nurseries sell more than others
    const weights = nurseries.map((_, i) => 1 + (i % 5 === 0 ? 2.5 : i % 3 === 0 ? 1.2 : 0));
    const weightedNursery = () => {
      let r = rand() * weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < nurseries.length; i++) { r -= weights[i] ?? 0; if (r <= 0) return nurseries[i] ?? ''; }
      return nurseries[0] ?? '';
    };

    const usedCodes = new Set<string>();
    const shortCode = () => {
      for (;;) {
        const code = Array.from({ length: 6 }, () => SHORT.charAt(Math.floor(rand() * SHORT.length))).join('');
        if (!usedCodes.has(code)) { usedCodes.add(code); return code; }
      }
    };

    let orders = 0;
    const now = Date.now();
    for (let daysAgo = 364; daysAgo >= 0; daysAgo--) {
      const day = new Date(now - daysAgo * 86_400_000);
      const month = day.getUTCMonth() + 1;
      const season = [3, 4, 5, 9, 10, 11].includes(month) ? 1.9 : 0.6; // the rains
      const growth = 0.45 + (364 - daysAgo) / 364; // more buyers as the year goes on
      const expected = 0.75 * season * growth;
      const count = Math.floor(expected) + (rand() < expected % 1 ? 1 : 0);
      for (let k = 0; k < count; k++) {
        const nurseryId = weightedNursery();
        const lines = byNursery.get(nurseryId) ?? [];
        if (lines.length === 0) continue;
        const chosen = [...new Set(Array.from({ length: 1 + Math.floor(rand() * Math.min(3, lines.length)) }, () => pick(lines)))];
        const items = chosen.map(l => {
          const quantity = 10 * (1 + Math.floor(rand() * (rand() < 0.15 ? 40 : 12)));
          return { ...l, quantity, line: quantity * l.unit_price };
        });
        const itemsTotal = items.reduce((s, i) => s + i.line, 0);
        const deliver = rand() < 0.62;
        const km = deliver ? Math.round((2 + rand() * 22) * 10) / 10 : null;
        const fee = deliver && km !== null ? Math.round((4000 + km * 900) / 500) * 500 : 0;
        const created = new Date(day.getTime() - Math.floor(rand() * 10 * 3_600_000));
        const fate = rand();
        // Recent orders are still on their way; older ones have mostly completed
        const status =
          fate < 0.03 ? 'cancelled' :
          fate < 0.08 ? 'refunded' :
          daysAgo === 0 && fate < 0.4 ? 'escrow_held' :
          daysAgo <= 2 && fate < 0.7 ? 'dispatched' :
          daysAgo <= 3 && fate < 0.85 ? 'delivered' :
          fate < 0.1 ? 'disputed' : 'released';
        const paid = status !== 'cancelled';
        const at = (hours: number) => new Date(created.getTime() + hours * 3_600_000);
        const method = rand() < 0.78 ? 'mtn_momo' : 'airtel_money';
        const buyerId = pick(buyerIds);
        const lat = items[0]?.lat ?? 0.35;
        const lng = items[0]?.lng ?? 32.75;

        const { rows: [order] } = await client.query<{ id: string }>(
          `INSERT INTO orders (short_code, user_id, nursery_id, delivery_type, delivery_point, delivery_address, distance_km, delivery_fee, items_total, grand_total,
                               status, payment_method, paid_at, dispatched_at, delivered_at, released_at, created_at)
           VALUES ($1, $2, $3, $4, CASE WHEN $5::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($5::float8, $6::float8), 4326) END,
                   $18, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
           RETURNING id`,
          [
            shortCode(), buyerId, nurseryId, deliver ? 'order_and_deliver' : 'self_pickup',
            deliver ? lng + (rand() - 0.5) * 0.2 : null, deliver ? lat + (rand() - 0.5) * 0.2 : null,
            km, fee, itemsTotal, itemsTotal + fee, status, method,
            paid ? at(0.05) : null,
            ['dispatched', 'delivered', 'released', 'disputed'].includes(status) ? at(20) : null,
            ['delivered', 'released'].includes(status) ? at(44) : null,
            status === 'released' ? at(46) : null,
            created,
            deliver ? 'Demo address' : null,
          ]
        );
        if (!order) continue;
        for (const i of items) {
          await client.query(
            `INSERT INTO order_items (order_id, inventory_id, species_id, quantity, unit_price_snapshot, line_total) VALUES ($1, $2, $3, $4, $5, $6)`,
            [order.id, i.id, i.species_id, i.quantity, i.unit_price, i.line]
          );
        }
        const phone = DEMO_PHONE(1 + buyerIds.indexOf(buyerId));
        await client.query(
          `INSERT INTO payments (order_id, kind, provider, msisdn, amount, status, created_at) VALUES ($1, 'collection', 'mock', $2, $3, $4, $5)`,
          [order.id, phone, itemsTotal + fee, paid ? 'successful' : 'failed', created]
        );
        orders++;
      }
    }

    await client.query(
      `INSERT INTO audit_log (actor_id, action, entity, entity_id, after) VALUES (NULL, 'demo.load', 'orders', NULL, $1::jsonb)`,
      [JSON.stringify({ buyers: BUYERS, orders, note: 'Invented demo activity for development (Insights charts); not real orders' })]
    );
    await client.query('COMMIT');
    return { buyers: BUYERS, orders };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const config = parseConfig(process.env);
  if (config.NODE_ENV === 'production') {
    console.error('Refusing to load demo activity into a production database');
    process.exit(1);
  }
  const pool = createPool(config.DATABASE_URL);
  try {
    const r = await loadDemoActivity(pool);
    console.log(`Loaded ${String(r.orders)} demo orders from ${String(r.buyers)} demo buyers (development only; invented data)`);
  } finally {
    await pool.end();
  }
}
