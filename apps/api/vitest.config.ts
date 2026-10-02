import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolve workspace packages (e.g. @nurserylink/shared) to their TypeScript source
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    globalSetup: ['test/globalSetup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
