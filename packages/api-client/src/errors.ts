import type { ErrorCode } from '@nurserylink/shared';

/** Client-side failures that never reach the API. */
export type ClientErrorCode = 'network_error' | 'unexpected_response';

/**
 * Every failed call rejects with an ApiError: the API's own `{ error: { code, message, details } }`,
 * or a client-side code when the request never got an answer (offline, DNS, CORS).
 */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | ClientErrorCode,
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level problems from a 400, keyed by path (e.g. "phone", "answers.land_acres"). */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    const collect = (d: unknown) => {
      if (Array.isArray(d)) d.forEach(collect);
      else if (d && typeof d === 'object' && 'path' in d && 'message' in d && typeof d.message === 'string') {
        const path = Array.isArray(d.path) ? d.path.join('.') : String(d.path);
        out[path] ??= d.message;
      }
    };
    collect(this.details);
    return out;
  }

  get isOffline(): boolean {
    return this.code === 'network_error';
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

/** Reads the API's error envelope; anything else becomes `unexpected_response`. */
export const toApiError = (status: number, body: unknown): ApiError => {
  if (body && typeof body === 'object' && 'error' in body && body.error && typeof body.error === 'object') {
    const e = body.error as { code?: unknown; message?: unknown; details?: unknown };
    if (typeof e.code === 'string' && typeof e.message === 'string') {
      return new ApiError(e.code as ErrorCode, e.message, status, e.details);
    }
  }
  return new ApiError('unexpected_response', `Unexpected response from the server (${String(status)})`, status);
};
