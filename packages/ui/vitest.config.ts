import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Workspace packages resolve to their TypeScript source (the "source" export condition), so tests
  // don't depend on a built dist/ (a fresh CI checkout has none)
  // (the rest is Vite's default client list; this package doesn't depend on vite directly)
  resolve: { conditions: ['source', 'module', 'browser', 'development|production'] },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./vitest.setup.ts'] },
});
