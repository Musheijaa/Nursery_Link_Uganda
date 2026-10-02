import type { Response } from 'supertest';
import type { ErrorEnvelope, SuccessEnvelope } from '@nurserylink/shared';

/** Typed access to response envelopes (Supertest types every body as `any`). */
export const dataOf = (res: Response): unknown => (res.body as SuccessEnvelope<unknown>).data;

export const errorOf = (res: Response): ErrorEnvelope['error'] => (res.body as ErrorEnvelope).error;
