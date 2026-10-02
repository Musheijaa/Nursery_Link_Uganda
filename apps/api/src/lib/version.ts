import { readFileSync } from 'node:fs';

/**
 * The API version from apps/api/package.json. Read from disk because npm_package_version is only
 * set when started through a package script; the path is the same from src/ and dist/.
 */
export const API_VERSION: string = (() => {
  const pkg: unknown = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  return typeof pkg === 'object' && pkg !== null && 'version' in pkg && typeof pkg.version === 'string' ? pkg.version : '0.0.0';
})();
