import type { ErrorCode } from '@nurserylink/shared';

/** Base class for every error the API returns deliberately. The error handler maps it to the envelope. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'The request is not valid', details?: unknown) {
    super(400, 'validation_error', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Please sign in to continue') {
    super(401, 'unauthorized', message);
  }
}

/** Correct credentials, but the phone number has not been confirmed with an SMS code yet. */
export class PhoneNotVerifiedError extends AppError {
  constructor() {
    super(403, 'phone_not_verified', 'Confirm your phone number with the code we sent by SMS before signing in');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to do this') {
    super(403, 'forbidden', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, 'not_found', message);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'Request body is too large') {
    super(413, 'payload_too_large', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, 'conflict', message, details);
  }
}

export class RateLimitedError extends AppError {
  constructor(message = 'Too many requests. Please wait a moment and try again.') {
    super(429, 'rate_limited', message);
  }
}

/** An external service (payments, SMS, routing, email) failed or is unreachable. */
export class ProviderUnavailableError extends AppError {
  constructor(message: string, details?: unknown) {
    super(503, 'provider_unavailable', message, details);
  }
}
