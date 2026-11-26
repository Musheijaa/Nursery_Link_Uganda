import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { AdminLayout } from '../components/AdminLayout';
import { RequireAdmin } from '../components/RequireAdmin';
import { NotFound, RouteError } from '../routes/Placeholders';

/** Each screen is its own chunk, loaded when first opened. */
const page = (path: string, load: () => Promise<{ default: ComponentType }>): RouteObject => ({
  path,
  errorElement: <RouteError />,
  lazy: async () => ({ Component: (await load()).default }),
});

export const router = createBrowserRouter([
  { path: '/login', lazy: async () => ({ Component: (await import('../features/auth/LoginPage')).default }) },
  {
    element: <RequireAdmin><AdminLayout /></RequireAdmin>,
    errorElement: <RouteError />,
    children: [
      page('/', () => import('../routes/Dashboard')),
      page('/insights', () => import('../routes/Insights')),
      page('/nurseries', () => import('../routes/Nurseries')),
      page('/nurseries/:id', () => import('../routes/NurseryForm')),
      page('/inventory', () => import('../routes/Inventory')),
      page('/species', () => import('../routes/Species')),
      page('/species/:id', () => import('../routes/SpeciesForm')),
      page('/news', () => import('../routes/News')),
      page('/news/:id', () => import('../routes/NewsForm')),
      page('/delivery-rates', () => import('../routes/DeliveryRates')),
      page('/giveaways', () => import('../routes/Campaigns')),
      page('/giveaways/:id', () => import('../routes/CampaignForm')),
      page('/giveaways/:id/applications', () => import('../routes/Applications')),
      page('/categories', () => import('../routes/Categories')),
      page('/expert-services', () => import('../routes/ExpertServices')),
      page('/partners', () => import('../routes/Partners')),
      page('/page-content', () => import('../routes/PageContent')),
      page('/orders', () => import('../routes/Orders')),
      page('/orders/:id', () => import('../routes/OrderDetail')),
      page('/payouts', () => import('../routes/Payouts')),
      page('/inbox', () => import('../routes/Inbox')),
      page('/audit-log', () => import('../routes/AuditLog')),
      page('/shadow', () => import('../routes/Shadow')),
      { path: '*', element: <NotFound /> },
    ],
  },
]);
