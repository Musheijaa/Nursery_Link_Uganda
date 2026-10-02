import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { session } from '../../lib/api';
import { buyer, http, server, tokensFor } from '../../test/msw';
import { renderRoute } from '../../test/render';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';

describe('RegisterPage', () => {
  it('validates with the shared schema before calling the API', async () => {
    renderRoute(<RegisterPage />, { path: '/register', at: '/register' });
    await userEvent.type(screen.getByLabelText('Full name'), 'N');
    await userEvent.type(screen.getByLabelText(/Phone number/), '12345');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Enter your full name')).toBeInTheDocument();
    expect(screen.getByText('Enter a Ugandan mobile number, e.g. 0772 123 456')).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone number/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('sends the number in +256 form and goes to the code screen, keeping where to return', async () => {
    let sent: unknown;
    server.use(
      http.post('/auth/register', async ({ request, response }) => {
        sent = await request.json();
        return response(201).json({ data: { user: { ...buyer, phone_verified: false }, verification: { sent_to: buyer.phone, expires_in_minutes: 10 }, tokens: null } });
      })
    );
    renderRoute(<RegisterPage />, { path: '/register', at: '/register?next=/orders', otherRoutes: ['/verify'] });
    await userEvent.type(screen.getByLabelText('Full name'), 'Nakato Sarah');
    await userEvent.type(screen.getByLabelText(/Phone number/), '0772 123 456');
    await userEvent.type(screen.getByLabelText('Password'), 'seedlings-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/verify?phone=%2B256772123456&next=%2Forders');
    expect(sent).toEqual({ full_name: 'Nakato Sarah', phone: '+256772123456', password: 'seedlings-2026' });
  });
});

describe('RegisterPage while phone verification is switched off', () => {
  it('is signed in straight away and returns to the page that asked, with no code screen', async () => {
    server.use(http.post('/auth/register', ({ response }) => response(201).json({ data: { user: buyer, verification: null, tokens: tokensFor(buyer) } })));
    renderRoute(<RegisterPage />, { path: '/register', at: '/register?next=/orders', otherRoutes: ['/orders', '/verify'] });
    await userEvent.type(screen.getByLabelText('Full name'), 'Nakato Sarah');
    await userEvent.type(screen.getByLabelText(/Phone number/), '0772 123 456');
    await userEvent.type(screen.getByLabelText('Password'), 'seedlings-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByTestId('location')).toHaveTextContent(/^\/orders$/);
    expect(session.snapshot.user?.full_name).toBe('Nakato Sarah');
    session.signOut();
  });
});

describe('LoginPage', () => {
  it("shows the API's message when the details are wrong", async () => {
    server.use(http.post('/auth/login', ({ response }) => response(401).json({ error: { code: 'unauthorized', message: 'Phone number, email or password is not correct' } })));
    renderRoute(<LoginPage />, { path: '/login', at: '/login' });
    await userEvent.type(screen.getByLabelText(/Phone number or email/), '0772123456');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Phone number, email or password is not correct');
  });

  it('signs in and returns to the page that asked', async () => {
    server.use(http.post('/auth/login', ({ response }) => response(200).json({ data: tokensFor(buyer) })));
    renderRoute(<LoginPage />, { path: '/login', at: '/login?next=/orders/abc', otherRoutes: ['/orders/:id'] });
    await userEvent.type(screen.getByLabelText(/Phone number or email/), '0772123456');
    await userEvent.type(screen.getByLabelText('Password'), 'seedlings-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/orders/abc');
    expect(session.snapshot.user?.full_name).toBe('Nakato Sarah');
    session.signOut();
  });

  it('sends an unconfirmed number to the code screen with a fresh code', async () => {
    let codeRequested = false;
    server.use(
      http.post('/auth/login', ({ response }) => response(403).json({ error: { code: 'phone_not_verified', message: 'Please confirm your phone number first' } })),
      http.post('/auth/verify/request', ({ response }) => {
        codeRequested = true;
        return response(202).json({ data: { message: 'sent' } });
      })
    );
    renderRoute(<LoginPage />, { path: '/login', at: '/login', otherRoutes: ['/verify'] });
    await userEvent.type(screen.getByLabelText(/Phone number or email/), '0772123456');
    await userEvent.type(screen.getByLabelText('Password'), 'seedlings-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => { expect(codeRequested).toBe(true); });
    expect(await screen.findByTestId('location')).toHaveTextContent('/verify?phone=%2B256772123456');
  });
});
