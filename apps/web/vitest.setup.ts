import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './src/test/msw';

// findBy… queries wait up to 5 s (the 1 s default is too short on a loaded CI runner)
configure({ asyncUtilTimeout: 5000 });

beforeAll(() => { server.listen({ onUnhandledFrame: 'error' }); });
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => { server.close(); });
