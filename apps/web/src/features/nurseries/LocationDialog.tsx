import { Button, Dialog, toast } from '@nurserylink/ui';
import { LocateFixed } from 'lucide-react';
import { useCallback, useState } from 'react';
import { en } from '../../copy/en';
import type { LatLng } from '../../lib/geo';
import { PlaceSearch } from '../search/PlaceSearch';
import { locationStatus, requestLocation, setTypedLocation, useUserLocation } from './location';

/**
 * Explains why we want the location before the browser asks (NFR: clear reason, graceful
 * refusal). `ask(then)` runs `then(position)` straight away when we already have it.
 */
export const useAskLocation = () => {
  const { position, status } = useUserLocation();
  const [pending, setPending] = useState<((p: LatLng) => void) | null>(null);

  const ask = useCallback(
    (then: (p: LatLng) => void) => {
      if (position) then(position);
      else setPending(() => then);
    },
    [position]
  );

  const allow = async () => {
    const then = pending;
    setPending(null);
    const p = await requestLocation();
    if (p) then?.(p);
    else toast.error(locationStatus() === 'denied' ? en.location.denied : en.location.unavailable);
  };

  const dialog = (
    <Dialog
      open={pending !== null}
      onOpenChange={open => { if (!open) setPending(null); }}
      title={en.location.askTitle}
      description={en.location.askBody}
      footer={
        <>
          <Button variant="ghost" onClick={() => { setPending(null); }}>{en.location.notNow}</Button>
          <Button onClick={() => { void allow(); }}>
            <LocateFixed aria-hidden />
            {en.location.allow}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2 rounded-md bg-mist p-3">
        <p className="font-bold text-canopy">{en.location.typeInstead}</p>
        <PlaceSearch
          id="location-place"
          inline
          onPick={place => {
            const then = pending;
            setPending(null);
            then?.(setTypedLocation(place));
          }}
        />
      </div>
    </Dialog>
  );

  return { ask, dialog, position, finding: status === 'asking' };
};
