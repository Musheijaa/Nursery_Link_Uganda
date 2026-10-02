import { isApiError } from '@nurserylink/api-client';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

/**
 * Puts an API validation error next to the fields it names. Returns the message to show above
 * the form when the error is not about a particular field.
 */
export const applyApiError = <T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: readonly Path<T>[]): string | null => {
  if (!isApiError(error)) return 'Something went wrong. Please try again.';
  const byField = error.fieldErrors();
  let placed = false;
  for (const field of fields) {
    const message = byField[field];
    if (message) {
      setError(field, { type: 'server', message });
      placed = true;
    }
  }
  return placed ? null : error.message;
};
