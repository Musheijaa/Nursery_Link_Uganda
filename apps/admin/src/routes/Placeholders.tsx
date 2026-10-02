import { EmptyState, ErrorState } from '@nurserylink/ui';
import { SearchX } from 'lucide-react';
import { useRouteError } from 'react-router';
import { en } from '../copy/en';

export const NotFound = () => <EmptyState headingLevel={1} icon={SearchX} title={en.notFound.title}>{en.notFound.body}</EmptyState>;

export const RouteError = () => {
  console.error(useRouteError());
  return <ErrorState headingLevel={1} title={en.routeError.title} onRetry={() => { window.location.reload(); }} retryLabel={en.states.retry}>{en.routeError.body}</ErrorState>;
};
