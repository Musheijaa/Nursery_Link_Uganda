import type { ShadowService } from '../modules/shadow/shadow.service.js';
import type { JobPayloads } from './queue.js';

/** Computes a Nursery Shadow run: service areas for every active nursery, then the shadow zones. */
export const shadowRun = (shadow: ShadowService) => async ({ runId }: JobPayloads['shadow-run']) => {
  await shadow.execute(runId);
};
