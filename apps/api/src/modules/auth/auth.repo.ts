import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { OtpPurpose } from '@nurserylink/shared';
import type { DbOrTx } from '../../db/client.js';
import { otpCodes, refreshTokens, users } from '../../db/schema.js';

export type UserRow = typeof users.$inferSelect;

// ── Users ──────────────────────────────────────────────────

export const findUserById = async (db: DbOrTx, id: string): Promise<UserRow | undefined> =>
  (await db.select().from(users).where(eq(users.id, id)))[0];

export const findUserByPhone = async (db: DbOrTx, phone: string): Promise<UserRow | undefined> =>
  (await db.select().from(users).where(eq(users.phone, phone)))[0];

export const findUserByEmail = async (db: DbOrTx, email: string): Promise<UserRow | undefined> =>
  (await db.select().from(users).where(eq(users.email, email)))[0];

export const insertUser = async (
  db: DbOrTx,
  values: { fullName: string; phone: string; email: string | null; passwordHash: string }
): Promise<UserRow> => {
  const [row] = await db.insert(users).values(values).returning();
  if (!row) throw new Error('User insert returned no row');
  return row;
};

/** Re-registration of a number that was never verified replaces the abandoned details. */
export const replaceUnverifiedUser = async (
  db: DbOrTx,
  id: string,
  values: { fullName: string; email: string | null; passwordHash: string }
): Promise<UserRow> => {
  const [row] = await db.update(users).set(values).where(and(eq(users.id, id), eq(users.phoneVerified, false))).returning();
  if (!row) throw new Error('Unverified user no longer exists');
  return row;
};

export const markPhoneVerified = async (db: DbOrTx, id: string): Promise<UserRow> => {
  const [row] = await db.update(users).set({ phoneVerified: true }).where(eq(users.id, id)).returning();
  if (!row) throw new Error('User not found');
  return row;
};

export const updatePassword = async (db: DbOrTx, id: string, passwordHash: string): Promise<void> => {
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
};

// ── One-time codes ─────────────────────────────────────────

export type OtpRow = typeof otpCodes.$inferSelect;

export const otpStats = async (db: DbOrTx, phone: string, purpose: OtpPurpose, since: Date) => {
  const [row] = await db
    .select({
      sentInWindow: sql<number>`count(*)::int`,
      lastSentAt: sql<Date | null>`max(${otpCodes.createdAt})`,
    })
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), eq(otpCodes.purpose, purpose), gt(otpCodes.createdAt, since)));
  return { sentInWindow: row?.sentInWindow ?? 0, lastSentAt: row?.lastSentAt ? new Date(row.lastSentAt) : null };
};

export const insertOtp = async (db: DbOrTx, values: { phone: string; purpose: OtpPurpose; codeHash: string; expiresAt: Date }) => {
  await db.insert(otpCodes).values(values);
};

/** The most recent unused code; older codes are superseded by newer ones. */
export const latestUnusedOtp = async (db: DbOrTx, phone: string, purpose: OtpPurpose): Promise<OtpRow | undefined> =>
  (
    await db
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.phone, phone), eq(otpCodes.purpose, purpose), isNull(otpCodes.consumedAt)))
      .orderBy(desc(otpCodes.createdAt))
      .limit(1)
  )[0];

export const recordFailedOtpAttempt = async (db: DbOrTx, id: string): Promise<void> => {
  await db.update(otpCodes).set({ attempts: sql`LEAST(${otpCodes.attempts} + 1, 5)` }).where(eq(otpCodes.id, id));
};

/** Marks a code used. Returns false if another request consumed it first. */
export const consumeOtp = async (db: DbOrTx, id: string): Promise<boolean> => {
  const rows = await db
    .update(otpCodes)
    .set({ consumedAt: sql`now()` })
    .where(and(eq(otpCodes.id, id), isNull(otpCodes.consumedAt)))
    .returning({ id: otpCodes.id });
  return rows.length === 1;
};

// ── Refresh tokens ─────────────────────────────────────────

export type RefreshTokenRow = typeof refreshTokens.$inferSelect;

export const insertRefreshToken = async (db: DbOrTx, values: { userId: string; tokenHash: string; expiresAt: Date }) => {
  await db.insert(refreshTokens).values(values);
};

/** Locks the row so two concurrent refreshes with the same token cannot both rotate it. */
export const findRefreshTokenForUpdate = async (db: DbOrTx, tokenHash: string): Promise<RefreshTokenRow | undefined> =>
  (await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).for('update'))[0];

export const revokeRefreshToken = async (db: DbOrTx, id: string): Promise<void> => {
  await db.update(refreshTokens).set({ revokedAt: sql`now()` }).where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)));
};

export const revokeRefreshTokenByHash = async (db: DbOrTx, tokenHash: string): Promise<void> => {
  await db.update(refreshTokens).set({ revokedAt: sql`now()` }).where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
};

export const revokeAllRefreshTokens = async (db: DbOrTx, userId: string): Promise<void> => {
  await db.update(refreshTokens).set({ revokedAt: sql`now()` }).where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
};
