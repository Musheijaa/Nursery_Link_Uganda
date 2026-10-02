import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './src/test/msw';

// findBy… queries wait up to 5 s (the 1 s default is too short on a loaded CI runner)
configure({ asyncUtilTimeout: 5000 });

// jsdom has no ResizeObserver; charts measure their width with it. Report a fixed 800 px width.
class FixedResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element) {
    this.callback([{ target, contentRect: { width: 800, height: 400 } } as unknown as ResizeObserverEntry], this);
  }
  unobserve() { /* nothing to undo */ }
  disconnect() { /* nothing to undo */ }
}
if (!('ResizeObserver' in globalThis)) globalThis.ResizeObserver = FixedResizeObserver;

beforeAll(() => { server.listen({ onUnhandledFrame: 'error' }); });
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => { server.close(); });
