import type { Schemas } from '@nurserylink/api-client';
import { Button, formatDistance } from '@nurserylink/ui';
import { List, Navigation, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { en } from '../../copy/en';
import type { LatLng } from '../../lib/geo';
import { googleMapsHref } from './NurseryCard';

/**
 * Phones: while the nursery card steps aside to show the route on the map, this bar along the
 * bottom keeps the summary in view, with the way back to the steps and on to Google Maps.
 */
export const RouteBar = ({ route, position, isDemo, onSteps, onEnd }: {
  route: Pick<Schemas['Route'], 'nursery' | 'distance_km' | 'distance_mode' | 'duration_min'>;
  position: LatLng | null;
  isDemo: boolean;
  onSteps: () => void;
  onEnd: () => void;
}) => {
  const steps = useRef<HTMLButtonElement>(null);
  // The card that had focus has closed; carry focus here so keyboard and screen-reader users follow
  useEffect(() => { steps.current?.focus(); }, []);
  return (
    <section
      aria-label={en.directions.routeBar}
      className="absolute inset-x-0 bottom-0 z-[500] flex flex-col gap-3 rounded-t-lg bg-paper px-4 pt-4 shadow-float pb-[calc(1rem+env(safe-area-inset-bottom))]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg">{en.directions.title(route.nursery.name)}</h2>
          <p className="font-bold text-canopy">{en.directions.summary(formatDistance(route.distance_km, route.distance_mode), route.duration_min)}</p>
        </div>
        <button type="button" onClick={onEnd} aria-label={en.directions.endDirections} className="flex size-11 shrink-0 items-center justify-center rounded-full text-forest ring-1 ring-line">
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button ref={steps} variant="secondary" onClick={onSteps}>
          <List aria-hidden />
          {en.directions.showSteps}
        </Button>
        {!isDemo && (
          <Button asChild>
            <a href={googleMapsHref(route.nursery.location, position)} target="_blank" rel="noopener noreferrer">
              <Navigation aria-hidden />
              {en.directions.navigateShort}
              <span className="sr-only"> {en.directions.newTab}</span>
            </a>
          </Button>
        )}
      </div>
    </section>
  );
};
