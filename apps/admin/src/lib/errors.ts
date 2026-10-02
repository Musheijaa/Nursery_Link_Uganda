import { isApiError } from '@nurserylink/api-client';
import { toast } from '@nurserylink/ui';

/** A failed admin action: the API's own message (it says what to do), as a toast. */
export const toastError = (err: unknown): void => {
  toast.error(isApiError(err) ? err.message : 'Something went wrong. Please try again.');
};
