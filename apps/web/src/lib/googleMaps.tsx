import { APIProvider } from '@vis.gl/react-google-maps';
import { MapPinOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { en } from '../copy/en';

/** Google Maps JavaScript API key, restricted to the site's domains in Google Cloud (set at build time). */
export const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
/** Advanced markers (our custom pins) need a Map ID; Google's demo ID works for development only. */
export const GOOGLE_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
export const mapsAvailable = GOOGLE_MAPS_KEY.length > 0;

/** Uganda, for the first view before the nurseries arrive */
export const UGANDA_BOUNDS = { north: 4.3, south: -1.5, west: 29.5, east: 35.1 };

/**
 * Loads the Google Maps script, only on pages that show a map (this module is part of their chunks).
 * Google's tiles aren't cached by our service worker (Google's terms), so offline pages show lists.
 */
export const MapsProvider = ({ children }: { children: ReactNode }) => (
  <APIProvider apiKey={GOOGLE_MAPS_KEY} libraries={['marker']} language="en" region="UG">
    {children}
  </APIProvider>
);

/** In place of a map when there's no API key or the connection is down. */
export const MapUnavailable = ({ reason, className }: { reason: 'no_key' | 'offline'; className?: string }) => (
  <div role="note" className={`flex flex-col items-center justify-center gap-2 bg-sand p-6 text-center text-bark ${className ?? ''}`}>
    <MapPinOff aria-hidden className="size-8 text-bark-muted" />
    <p className="max-w-sm">{reason === 'offline' ? en.maps.offline : en.maps.noKey}</p>
  </div>
);

/** A Google Maps link that gives directions from wherever the phone is (opens the Google Maps app on phones). */
export const directionsHref = (to: { lat: number; lng: number }) =>
  `https://www.google.com/maps/dir/?api=1&destination=${String(to.lat)},${String(to.lng)}`;
