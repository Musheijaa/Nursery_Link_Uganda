import pg from 'pg';
import { config } from '../config.js';

// Return BIGINT/NUMERIC as numbers; all our values fit comfortably in a JS number
pg.types.setTypeParser(pg.types.builtins.INT8, v => Number(v));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, v => Number(v));
// Keep DATE as 'YYYY-MM-DD'; parsing to a JS Date would shift it by the server's UTC offset
pg.types.setTypeParser(pg.types.builtins.DATE, v => v);

export const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10 });

// node-postgres only knows built-in array types. Teach it our enum arrays (e.g. delivery_method[])
// so they arrive as string arrays rather than raw '{a,b}' text.
let enumArraysReady: Promise<void> | null = null;
const registerEnumArrays = () => {
  enumArraysReady ??= pool
    .query<{ typarray: number }>(`SELECT t.typarray FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                                   WHERE t.typtype = 'e' AND n.nspname = 'public'`)
    .then(({ rows }) => {
      const parseTextArray = pg.types.getTypeParser(1009); // text[]
      for (const { typarray } of rows) pg.types.setTypeParser(typarray, parseTextArray);
    })
    .catch(err => {
      enumArraysReady = null;
      throw err;
    });
  return enumArraysReady;
};

/** Must be awaited once after migrations, before serving requests. */
export const prepareDatabase = () => registerEnumArrays();

export type Queryable = pg.Pool | pg.PoolClient;

export const query = <T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = [], db: Queryable = pool) =>
  db.query<T>(text, params);

/** Runs fn inside a transaction, rolling back if it throws. */
export const withTransaction = async <T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
