import { Button, ErrorState } from '@nurserylink/ui';
import { isApiError } from '@nurserylink/api-client';
import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { en } from '../copy/en';
import { usePageTitle } from './usePageTitle';
import { NotFoundPage } from '../routes/NotFound';

/** Per-route error boundary: the header and navigation keep working when one page fails. */
export const RouteError = () => {
  const error = useRouteError();
  usePageTitle(en.routeError.title);
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  // A lazily loaded page chunk that can't be fetched usually means the connection dropped
  const offline = (isApiError(error) && error.isOffline) || (error instanceof TypeError && /fetch|import/i.test(error.message));
  console.error(error);
  return (
    <ErrorState
      headingLevel={1}
      title={offline ? en.states.offlineNoCache : en.routeError.title}
      offline={offline}
      onRetry={() => { window.location.reload(); }}
      retryLabel={en.states.retry}
    >
      <p>{offline ? en.states.loadFailedHelp : en.routeError.body}</p>
      <Button asChild variant="ghost" className="mt-2">
        <Link to="/">{en.states.goHome}</Link>
      </Button>
    </ErrorState>
  );
};
