/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin; empty means same origin (the dev server proxies /api) */
  readonly VITE_API_URL?: string;
  /** Map tile URL template (the Nursery Shadow map, which stays on OpenStreetMap) */
  readonly VITE_TILE_URL?: string;
  /** Google Maps JavaScript API key for the nursery location picker; empty: no picker map */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  /** Google Maps Map ID (advanced markers); empty: Google's DEMO_MAP_ID */
  readonly VITE_GOOGLE_MAPS_MAP_ID?: string;
  /** Public site origin, for its photos (/images/...); empty means same origin */
  readonly VITE_PUBLIC_WEB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
