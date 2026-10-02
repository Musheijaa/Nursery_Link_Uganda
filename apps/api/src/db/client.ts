import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';

export type Database = NodePgDatabase;
/** A transaction handle, as passed to db.transaction(tx => …) */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
/** Repositories accept either, so services decide the transaction boundary */
export type DbOrTx = Database | Tx;

export const createPool = (connectionString: string) => new pg.Pool({ connectionString, max: 10 });

export const createDb = (pool: pg.Pool): Database => drizzle(pool);
