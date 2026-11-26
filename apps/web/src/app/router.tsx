import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate, useLocation, useParams, type RouteObject } from 'react-router';
import { Layout } from '../components/Layout';
import { RequireAuth } from '../components/RequireAuth';
import { RouteError } from '../components/RouteError';
import { NotFoundPage } from '../routes/NotFound';
import Home from '../routes/Home';

/** A route whose page component is a lazily loaded module (one chunk per page). */
const page = (path: string, load: () => Promise<{ default: ComponentType }>, opts: { auth?: boolean } = {}): RouteObject => ({
  path,
  errorElement: <RouteError />,
  lazy: async () => {
    const { default: Page } = await load();
    return { Component: opts.auth ? () => <RequireAuth><Page /></RequireAuth> : Page };
  },
});

/** Old addresses (bookmarks, SMS links, search engines) go to their new pages. The servers also send a 301. */
const Redirect = ({ to }: { to: (params: Record<string, string | undefined>) => string }) => {
  const params = useParams();
  const { search, hash } = useLocation();
  return <Navigate to={`${to(params)}${search}${hash}`} replace />;
};

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      // Home is the landing page: loaded with the app, not as a separate chunk (one round trip less)
      { path: '/', Component: Home, errorElement: <RouteError />, handle: { bare: true } },
      { ...page('/nurseries', () => import('../routes/Nurseries')), handle: { fullBleed: true } },
      page('/nurseries/:id/order', () => import('../routes/Checkout'), { auth: true }),
      page('/library', () => import('../routes/Library')),
      page('/library/:slug', () => import('../routes/Species')),
      page('/news', () => import('../routes/News')),
      page('/news/:slug', () => import('../routes/NewsArticle')),
      page('/giveaways', () => import('../routes/Giveaways')),
      page('/giveaways/:id', () => import('../routes/Giveaway')),
      page('/expert-services', () => import('../routes/ExpertServices')),
      page('/donate', () => import('../routes/Donate')),
      page('/search', () => import('../routes/Search')),
      { path: '/free-seedlings', element: <Redirect to={() => '/giveaways'} /> },
      { path: '/free-seedlings/:id', element: <Redirect to={p => `/giveaways/${p.id ?? ''}`} /> },
      { path: '/services', element: <Redirect to={() => '/expert-services'} /> },
      page('/feedback', () => import('../routes/Feedback')),
      page('/survey', () => import('../routes/Survey')),
      page('/orders', () => import('../routes/Orders'), { auth: true }),
      page('/orders/:id', () => import('../routes/Order'), { auth: true }),
      // The nursery's order map, from the order SMS (no account; the link carries a key)
      page('/o/:code', () => import('../routes/OrderMap')),
      // Accounts
      page('/register', () => import('../features/auth/RegisterPage')),
      page('/verify', () => import('../features/auth/VerifyPage')),
      page('/login', () => import('../features/auth/LoginPage')),
      page('/forgot-password', () => import('../features/auth/ForgotPasswordPage')),
      page('/reset-password', () => import('../features/auth/ResetPasswordPage')),
      page('/credits', () => import('../routes/Credits')),
      // Eager: the error boundary already includes it
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
