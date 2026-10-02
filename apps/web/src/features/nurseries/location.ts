import { useSyncExternalStore } from 'react';
import type { LatLng } from '../../lib/geo';

export type LocationStatus = 'unknown' | 'asking' | 'granted' | 'denied' | 'unavailable';

interface LocationState {
  status: LocationStatus;
  position: LatLng | null;
}

// Kept for this browser session only (UI state, never sent anywhere except as a query to the API)
const STORAGE_KEY = 'nl.location';
const load = (): LocationState => {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) return { status: 'granted', position: JSON.parse(saved) as LatLng };
  } catch (err) {
    console.warn('Session storage unavailable', err);
  }
  return { status: 'unknown', position: null };
};

let state: LocationState = typeof window === 'undefined' ? { status: 'unknown', position: null } : load();
const listeners = new Set<() => void>();
const set = (next: LocationState) => {
  state = next;
  for (const l of listeners) l();
};

/** The current status, read at call time (e.g. right after a request settles). */
export const locationStatus = (): LocationStatus => state.status;

export const useUserLocation = (): LocationState =>
  useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state
  );

/**
 * A position the person typed instead (a place they searched for). Kept for the session like a GPS
 * fix, rounded the same way.
 */
export const setTypedLocation = (p: LatLng): LatLng => {
  const position = { lat: Math.round(p.lat * 1000) / 1000, lng: Math.round(p.lng * 1000) / 1000 };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  } catch (err) {
    console.warn('Could not remember the location for this session', err);
  }
  set({ status: 'granted', position });
  return position;
};

/**
 * Asks the browser for the user's position (after the app has explained why). Resolves to the
 * position, or null when refused or unavailable; the status says which.
 */
export const requestLocation = (): Promise<LatLng | null> =>
  new Promise(resolve => {
    if (!('geolocation' in navigator)) {
      set({ status: 'unavailable', position: null });
      resolve(null);
      return;
    }
    set({ ...state, status: 'asking' });
    navigator.geolocation.getCurrentPosition(
      pos => {
        // ~100 m precision is plenty for road distances, and reveals less
        const position = { lat: Math.round(pos.coords.latitude * 1000) / 1000, lng: Math.round(pos.coords.longitude * 1000) / 1000 };
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(position));
        } catch (err) {
          console.warn('Could not remember the location for this session', err);
        }
        set({ status: 'granted', position });
        resolve(position);
      },
      err => {
        set({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable', position: null });
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 5 * 60_000 }
    );
  });
