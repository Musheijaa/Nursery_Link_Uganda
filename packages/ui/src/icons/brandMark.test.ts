import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRAND_MARK_BODY, brandMarkSvg } from './brandMarkSvg';

describe('brand mark', () => {
  it('is the same drawing in both favicons', () => {
    for (const app of ['web', 'admin']) {
      // Tests run from packages/ui (jsdom gives import.meta.url an http scheme)
      const favicon = readFileSync(resolve(process.cwd(), `../../apps/${app}/public/favicon.svg`), 'utf8').trim();
      expect(favicon, app).toBe(brandMarkSvg());
    }
    expect(BRAND_MARK_BODY).toContain('#2b6a97');
  });
});
