import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { session } from '../../lib/api';
import { buyer, http, server, tokensFor } from '../../test/msw';
import { renderRoute } from '../../test/render';
import LoginPage from './LoginPage';

const signInAs = async (role: 'buyer' | 'admin') => {
  server.use(http.post('/auth/login', ({ response }) => response(200).json({ data: tokensFor({ ...buyer, role } as typeof buyer) })));
  renderRoute(<LoginPage />, { path: '/login', at: '/login?next=/orders', otherRoutes: ['/orders'] });
  await userEvent.type(screen.getByLabelText('Phone number or email'), 'admin@example.org');
  await userEvent.type(screen.getByLabelText('Password'), 'a-long-password');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
};

describe('admin LoginPage', () => {
  it('refuses buyer accounts and keeps them signed out of the console', async () => {
    await signInAs('buyer');
    expect(await screen.findByRole('alert')).toHaveTextContent('This account is not an administrator');
    expect(session.token).toBeNull();
  });

  it('signs administrators in and returns to the page they asked for', async () => {
    await signInAs('admin');
    expect(await screen.findByTestId('location')).toHaveTextContent('/orders');
    expect(session.snapshot.user?.role).toBe('admin');
    session.signOut();
  });
});
