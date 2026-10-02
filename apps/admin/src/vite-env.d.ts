/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin; empty means same origin (the dev server proxies /api) */
  readonly VITE_API_URL?: string;
  /** Map tile URL template */
  readonly VITE_TILE_URL?: string;
  /** Public site origin, for its photos (/images/...); empty means same origin */
  readonly VITE_PUBLIC_WEB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
