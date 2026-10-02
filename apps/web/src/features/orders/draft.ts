import type { DeliveryType, MobileMoneyMethod } from '@nurserylink/shared';
import { useCallback, useState } from 'react';
import type { LatLng } from '../../lib/geo';

/** What the buyer has chosen so far. UI state: kept in this tab's session, never sent until the order. */
export interface OrderDraft {
  quantities: Record<string, number>;
  deliveryType: DeliveryType;
  point: LatLng | null;
  address: string;
  method: MobileMoneyMethod | null;
  payer: string;
}

const empty = (): OrderDraft => ({ quantities: {}, deliveryType: 'order_and_deliver', point: null, address: '', method: null, payer: '' });
const key = (nurseryId: string) => `nl.order.${nurseryId}`;

const read = (nurseryId: string): OrderDraft => {
  try {
    const raw = sessionStorage.getItem(key(nurseryId));
    return raw ? { ...empty(), ...(JSON.parse(raw) as Partial<OrderDraft>) } : empty();
  } catch (err) {
    console.warn('Could not read the order draft', err);
    return empty();
  }
};

const write = (nurseryId: string, draft: OrderDraft) => {
  try {
    sessionStorage.setItem(key(nurseryId), JSON.stringify(draft));
  } catch (err) {
    console.warn('Could not save the order draft', err);
  }
};

/** The draft for one nursery: survives a refresh and a failed payment ("Try again"). */
export const useOrderDraft = (nurseryId: string) => {
  const [draft, setDraft] = useState(() => read(nurseryId));
  const update = useCallback(
    (changes: Partial<OrderDraft>) => {
      setDraft(prev => {
        const next = { ...prev, ...changes };
        write(nurseryId, next);
        return next;
      });
    },
    [nurseryId]
  );
  return { draft, update };
};

/** Forget a nursery's draft (after the payment succeeded). */
export const clearDraft = (nurseryId: string): void => {
  try {
    sessionStorage.removeItem(key(nurseryId));
  } catch (err) {
    console.warn('Could not clear the order draft', err);
  }
};

export const chosenItems = (draft: OrderDraft) =>
  Object.entries(draft.quantities)
    .filter(([, q]) => q > 0)
    .map(([inventory_id, quantity]) => ({ inventory_id, quantity }));
