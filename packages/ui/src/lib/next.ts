/**
 * Where to go after signing in. Only same-site paths are followed (never "//evil.example" or
 * "https://…"), so a crafted link can't send people off the site.
 */
export const safeNext = (raw: string | null | undefined, fallback = '/'): string =>
  raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : fallback;

export const withNext = (path: string, next: string | null | undefined): string =>
  next && safeNext(next) !== '/' ? `${path}${path.includes('?') ? '&' : '?'}next=${encodeURIComponent(safeNext(next))}` : path;
