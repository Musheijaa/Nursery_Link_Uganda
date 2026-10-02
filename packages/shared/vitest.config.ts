import { defineConfig } from 'vitest/config';

// Tests live next to the source; never run compiled copies in dist/
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
