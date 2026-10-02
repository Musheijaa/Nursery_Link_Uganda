import { useEffect } from 'react';
import { en } from '../copy/en';

/** Sets the browser tab title, e.g. "Sign in · Nursery Link Uganda". */
export const usePageTitle = (title?: string): void => {
  useEffect(() => {
    document.title = title ? `${title} · ${en.app.fullName}` : en.app.fullName;
  }, [title]);
};
