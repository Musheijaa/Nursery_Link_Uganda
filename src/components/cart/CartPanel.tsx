import React, { useEffect, useState } from 'react';
import { ArrowLeft, Trash2, X } from 'lucide-react';
import { CartItem, useApp } from '../../context/AppContext';
import { formatNumber, formatUGX } from '../../utils/format';
import { Button, EmptyState } from '../ui';
import { Checkout } from './Checkout';

/** Slide-over cart. Items are grouped by nursery because each nursery delivers and is paid separately. */
export const CartPanel: React.FC = () => {
  const { isCartOpen, setCartOpen, cart, setCartQuantity, navigate } = useApp();
  const [checkoutNurseryId, setCheckoutNurseryId] = useState<string | null>(null);
  // Keep the items being checked out, so the success screen still works after they leave the cart
  const [checkoutItems, setCheckoutItems] = useState<CartItem[]>([]);

  useEffect(() => {
    if (!isCartOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setCartOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isCartOpen, setCartOpen]);

  if (!isCartOpen) return null;

  const close = () => {
    setCartOpen(false);
    setCheckoutNurseryId(null);
  };

  const groups = cart.reduce<{ nurseryId: string; nurseryName: string; nurseryDistrict: string; lines: CartItem[] }[]>((acc, line) => {
    const group = acc.find(g => g.nurseryId === line.nurseryId);
    if (group) group.lines.push(line);
    else acc.push({ nurseryId: line.nurseryId, nurseryName: line.nurseryName, nurseryDistrict: line.nurseryDistrict, lines: [line] });
    return acc;
  }, []);

  const startCheckout = (nurseryId: string, lines: CartItem[]) => {
    setCheckoutItems(lines);
    setCheckoutNurseryId(nurseryId);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/50" onClick={close}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={checkoutNurseryId ? 'Checkout' : 'Cart'}
        onClick={e => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <div className="flex items-center gap-2">
            {checkoutNurseryId && (
              <button onClick={() => setCheckoutNurseryId(null)} className="rounded p-1 hover:bg-stone-100" aria-label="Back to cart">
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <h2 className="text-lg font-semibold">{checkoutNurseryId ? 'Checkout' : 'Your cart'}</h2>
          </div>
          <button onClick={close} className="rounded p-1 text-stone-500 hover:bg-stone-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {checkoutNurseryId ? (
            <Checkout
              nurseryId={checkoutNurseryId}
              items={checkoutItems}
              onViewOrders={() => { close(); navigate('orders'); }}
            />
          ) : groups.length === 0 ? (
            <EmptyState title="Your cart is empty">
              <button onClick={() => { close(); navigate('seedlings'); }} className="font-medium text-brand-700 hover:underline">
                Find seedlings
              </button>
            </EmptyState>
          ) : (
            <div className="space-y-6">
              {groups.length > 1 && (
                <p className="rounded-md bg-stone-50 p-3 text-sm text-stone-600">
                  Your cart has seedlings from {groups.length} nurseries. Each nursery delivers separately, so you check out with one at a time.
                </p>
              )}
              {groups.map(({ nurseryId, nurseryName, nurseryDistrict, lines }) => {
                const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPriceUGX, 0);
                return (
                  <section key={nurseryId} className="rounded-lg border border-stone-200">
                    <div className="border-b border-stone-200 px-4 py-3">
                      <h3 className="font-semibold">{nurseryName}</h3>
                      <p className="text-xs text-stone-500">{nurseryDistrict}</p>
                    </div>
                    <ul className="divide-y divide-stone-100">
                      {lines.map(line => (
                        <li key={line.batchId} className="flex items-center gap-3 px-4 py-3 text-sm">
                          <div className="flex-1">
                            <p className="font-medium">{line.speciesName}</p>
                            <p className="text-xs text-stone-500">{line.seedlingType} · {formatUGX(line.unitPriceUGX)} each</p>
                          </div>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={line.maxQuantity}
                            value={line.quantity}
                            onChange={e => setCartQuantity(line.nurseryId, line.batchId, parseInt(e.target.value, 10) || 1)}
                            className="h-8 w-20 rounded-md border border-stone-300 px-2 text-sm tabular-nums"
                            aria-label={`Quantity of ${line.speciesName}`}
                          />
                          <button
                            onClick={() => setCartQuantity(line.nurseryId, line.batchId, 0)}
                            className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-soil-700"
                            aria-label={`Remove ${line.speciesName}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between border-t border-stone-200 px-4 py-3">
                      <div className="text-sm">
                        <p className="text-stone-500">{formatNumber(lines.reduce((s, l) => s + l.quantity, 0))} seedlings</p>
                        <p className="font-semibold">{formatUGX(subtotal)}</p>
                      </div>
                      <Button onClick={() => startCheckout(nurseryId, lines)}>Checkout</Button>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
