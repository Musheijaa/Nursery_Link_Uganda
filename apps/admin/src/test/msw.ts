import type { paths } from '@nurserylink/api-client';
import { createOpenApiHttp } from 'openapi-msw';
import { setupServer } from 'msw/node';

/** MSW handlers typed from the API's OpenAPI document: mocks can't drift from the real contract. */
export const http = createOpenApiHttp<paths>({ baseUrl: 'http://localhost/api/v1' });

export const server = setupServer(
  // Visitors start signed out: no refresh cookie
  http.post('/auth/refresh', ({ response }) => response(401).json({ error: { code: 'unauthorized', message: 'Your session has ended. Please sign in again.' } }))
);

export const buyer = {
  id: '00000000-0000-4000-8000-000000000001',
  full_name: 'Nakato Sarah',
  phone: '+256772123456',
  email: null,
  role: 'buyer' as const,
  phone_verified: true,
  created_at: '2026-09-30T10:00:00.000Z',
};

export const tokensFor = (user: typeof buyer) => ({ access_token: 'access-token', token_type: 'Bearer' as const, expires_in: 900, user });
