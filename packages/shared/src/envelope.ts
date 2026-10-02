import type { ErrorCode } from './errors.js';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

/** Every successful response: `{ data, meta? }`. */
export interface SuccessEnvelope<T, M = Record<string, unknown>> {
  data: T;
  meta?: M;
}

/** Every error response: `{ error: { code, message, details? } }`. */
export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}
