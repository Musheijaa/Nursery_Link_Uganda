import { describe, expect, it } from 'vitest';
import { safeNext, withNext } from './next';

describe('safeNext', () => {
  it('follows same-site paths only', () => {
    expect(safeNext('/nurseries?species=mvule')).toBe('/nurseries?species=mvule');
    expect(safeNext('//evil.example/x')).toBe('/');
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext('/\\evil.example')).toBe('/');
    expect(safeNext(null, '/orders')).toBe('/orders');
  });

  it('carries the destination through the sign-in pages', () => {
    expect(withNext('/verify?phone=%2B256772123456', '/orders/1')).toBe('/verify?phone=%2B256772123456&next=%2Forders%2F1');
    expect(withNext('/login', '/')).toBe('/login');
  });
});
