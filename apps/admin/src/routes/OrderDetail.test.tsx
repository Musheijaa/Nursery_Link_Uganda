import type { OrderStatus } from '@nurserylink/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { http, server } from '../test/msw';
import { renderRoute } from '../test/render';
import OrderDetail from './OrderDetail';

const ID = '00000000-0000-4000-8000-0000000000aa';
const order = (status: OrderStatus) => ({
  id: ID,
  short_code: 'K7Q2MX',
  status,
  nursery: { id: '00000000-0000-4000-8000-0000000000bb', name: 'Mukono Town Nursery', contact_phone: '+256700100114' },
  delivery_type: 'self_pickup' as const,
  delivery_point: null,
  delivery_address: null,
  distance_km: null,
  items: [{ inventory_id: '00000000-0000-4000-8000-0000000000cc', species: { slug: 'mvule', common_name: 'Mvule' }, quantity: 3, unit_price: 1800, line_total: 5400 }],
  items_total: 5400,
  delivery_fee: 0,
  grand_total: 5400,
  payment_method: 'mtn_momo' as const,
  payment: { status: 'successful' as const, msisdn: '+256772123456' },
  created_at: '2026-10-01T10:00:00.000Z',
  paid_at: '2026-10-01T10:01:00.000Z',
  dispatched_at: null,
  delivered_at: null,
  released_at: null,
  buyer: { id: '00000000-0000-4000-8000-0000000000dd', full_name: 'Kato Joseph', phone: '+256772123456' },
});

const show = (status: OrderStatus) => {
  server.use(
    http.get('/admin/orders/{id}', ({ response }) => response(200).json({ data: order(status) })),
    http.get('/admin/audit-log', ({ response }) => response(200).json({ data: [], meta: { page: 1, limit: 100, total: 0 } }))
  );
  renderRoute(<OrderDetail />, { path: '/orders/:id', at: `/orders/${ID}` });
};

describe('admin OrderDetail', () => {
  it('offers only what the state machine allows from the current status', async () => {
    show('escrow_held');
    expect(await screen.findByRole('button', { name: 'Mark dispatched' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refund the buyer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Release payment to the nursery' })).not.toBeInTheDocument();
  });

  it('offers nothing on a finished order', async () => {
    show('released');
    expect(await screen.findByText('No actions: this order is finished or waiting for payment.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Refund|Release|dispatched/ })).not.toBeInTheDocument();
  });

  it('needs a reason, then sends it with the action', async () => {
    let sent: unknown = null;
    server.use(http.put('/admin/orders/{id}/status', async ({ request, response }) => {
      sent = await request.json();
      const { buyer: _buyer, ...updated } = order('disputed');
      return response(200).json({ data: updated });
    }));
    show('dispatched');
    await userEvent.click(await screen.findByRole('button', { name: 'Refund the buyer' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Refund the buyer' }));
    expect(within(dialog).getByText('Write a reason of at least 5 characters.')).toBeInTheDocument();
    expect(sent).toBeNull();
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Nursery has no Mvule left');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Refund the buyer' }));
    await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); });
    expect(sent).toEqual({ status: 'refunded', reason: 'Nursery has no Mvule left' });
  });
});
