import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';

/** Shows where the router ended up, for assertions on redirects. */
export const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
};

/** Renders `element` at `path` inside a memory router with a fresh query client. */
export const renderRoute = (element: ReactElement, { path = '/', at = '/', otherRoutes = [] as string[] } = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(
    [
      // A route can render the probe itself (e.g. to watch query-string changes)
      { path, element },
      ...otherRoutes.map(p => ({ path: p, element: <LocationProbe /> })),
    ],
    { initialEntries: [at] }
  );
  return { router, ...render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>) };
};
