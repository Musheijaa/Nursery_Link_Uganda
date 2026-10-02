import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { registerSW } from 'virtual:pwa-register';
import { router } from './app/router';
import { queryClient } from './lib/api';
import { restoreSession } from './lib/session';
import './styles.css';

// Sign back in from the refresh cookie while the first page renders
void restoreSession();

// Offline support: the service worker caches the app shell and data already viewed
if ('serviceWorker' in navigator && import.meta.env.PROD) registerSW({ immediate: true });

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);
