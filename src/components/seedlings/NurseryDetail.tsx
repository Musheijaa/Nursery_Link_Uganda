import React, { useState } from 'react';
import { MessageCircle, Phone } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useNursery, useSpecies } from '../../api/hooks';
import { errorMessage } from '../../api/client';
import { formatNumber, formatUGX } from '../../utils/format';
import { formatPhone, toInternational } from '../../utils/phone';
import { Badge, Button, EmptyState, Modal } from '../ui';

export const NurseryDetail: React.FC<{ nurseryId: string; buyerDistrict: string; onClose: () => void }> = ({
  nurseryId,
  buyerDistrict,
  onClose,
}) => {
  const { addToCart, setCartOpen, cart, speciesFilter } = useApp();
  const { data: nursery, isLoading, error } = useNursery(nurseryId, buyerDistrict);
  const { data: species = [] } = useSpecies();
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  if (!nursery) {
    return (
      <Modal title="Nursery" onClose={onClose}>
        {isLoading ? <p className="text-sm text-stone-600">Loading…</p> : <EmptyState title="Could not load this nursery">{errorMessage(error)}</EmptyState>}
      </Modal>
    );
  }

  const speciesName = (id: string) => species.find(s => s.id === id)?.commonName ?? id;
  const inCart = cart.filter(l => l.nurseryId === nursery.id);

  // Show the tree the buyer searched for first
  const batches = [...nursery.batches].sort((a, b) =>
    Number(b.speciesId === speciesFilter) - Number(a.speciesId === speciesFilter)
  );

  const handleAdd = (batchId: string) => {
    const qty = parseInt(quantities[batchId] ?? '', 10);
    const batch = nursery.batches.find(b => b.id === batchId);
    if (!batch || !qty || qty < 1) return;
    addToCart(nursery, batch, speciesName(batch.speciesId), qty);
    setQuantities(prev => ({ ...prev, [batchId]: '' }));
  };

  return (
    <Modal title={nursery.name} onClose={onClose} size="lg">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 text-sm">
            <p className="text-stone-700">{nursery.village}, {nursery.subCounty} sub-county, {nursery.district}</p>
            {nursery.distanceKm !== null && <p className="text-stone-500">About {nursery.distanceKm} km by road from {buyerDistrict}</p>}
            <p className="text-stone-500">Open {nursery.openingHours}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge tone="green">{nursery.registration}</Badge>
              <Badge>Reg. no. {nursery.registrationNumber}</Badge>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <p><span className="text-stone-500">Contact:</span> {nursery.operatorName}</p>
            <div className="flex flex-wrap gap-2">
              <a href={`tel:+${toInternational(nursery.phone)}`} className="inline-flex h-9 items-center gap-2 rounded-md border border-stone-300 px-3 font-medium hover:bg-stone-50">
                <Phone className="h-4 w-4" /> {formatPhone(nursery.phone)}
              </a>
              <a
                href={`https://wa.me/${toInternational(nursery.phone)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-stone-300 px-3 font-medium hover:bg-stone-50"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </div>
            <p className="text-stone-500">Delivery: {nursery.deliveryMethods.join(' · ')}</p>
          </div>
        </div>

        <p className="text-sm text-stone-700">{nursery.description}</p>

        <div>
          <h3 className="mb-2 font-semibold">Seedlings available</h3>
          <div className="divide-y divide-stone-100 rounded-lg border border-stone-200">
            {batches.map(batch => {
              const soldOut = batch.quantityAvailable === 0;
              return (
                <div key={batch.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{speciesName(batch.speciesId)}</span>
                      {batch.status === 'Ready soon' && <Badge tone="amber">Ready soon</Badge>}
                    </div>
                    <p className="text-sm text-stone-500">
                      {batch.seedlingType} · {batch.ageMonths} months · about {batch.heightCm} cm
                    </p>
                    <p className="mt-1 text-sm">
                      <strong>{formatUGX(batch.unitPriceUGX)}</strong> each ·{' '}
                      <span className={soldOut ? 'text-soil-700' : 'text-stone-600'}>
                        {soldOut ? 'Sold out' : `${formatNumber(batch.quantityAvailable)} in stock`}
                      </span>
                    </p>
                  </div>

                  <form
                    className="flex items-center gap-2"
                    onSubmit={e => {
                      e.preventDefault();
                      handleAdd(batch.id);
                    }}
                  >
                    <label className="sr-only" htmlFor={`qty-${batch.id}`}>Quantity</label>
                    <input
                      id={`qty-${batch.id}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={batch.quantityAvailable}
                      placeholder="Qty"
                      disabled={soldOut}
                      value={quantities[batch.id] ?? ''}
                      onChange={e => setQuantities(prev => ({ ...prev, [batch.id]: e.target.value }))}
                      className="h-9 w-24 rounded-md border border-stone-300 px-2 text-sm focus:border-brand-600 focus:outline-none"
                    />
                    <Button type="submit" size="sm" disabled={soldOut || !quantities[batch.id]}>Add</Button>
                  </form>
                </div>
              );
            })}
          </div>
        </div>

        {inCart.length > 0 && (
          <div className="flex flex-col gap-3 rounded-lg bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-brand-900">
              {formatNumber(inCart.reduce((s, l) => s + l.quantity, 0))} seedlings from this nursery in your cart ·{' '}
              {formatUGX(inCart.reduce((s, l) => s + l.quantity * l.unitPriceUGX, 0))}
            </p>
            <Button onClick={() => { onClose(); setCartOpen(true); }}>Go to checkout</Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
