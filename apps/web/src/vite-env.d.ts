/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin; empty means same origin (the dev server proxies /api) */
  readonly VITE_API_URL?: string;
  /** Google Maps JavaScript API key (restricted to the site's domains); empty: no map, the list instead */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  /** Google Maps Map ID for advanced markers (custom pins); empty: Google's DEMO_MAP_ID */
  readonly VITE_GOOGLE_MAPS_MAP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
