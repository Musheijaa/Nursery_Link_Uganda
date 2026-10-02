import type PgBoss from 'pg-boss';
import type { Logger } from 'pino';
import type { Services } from '../services.js';
import { autoRelease } from './autoRelease.js';
import { paymentPoll, paymentTimeout } from './paymentTimeout.js';
import { payoutCheck } from './payoutRetry.js';
import { JOB_NAMES, type JobName, type JobPayloads } from './queue.js';
import { shadowRun } from './shadowRun.js';
import { smsSend } from './smsRetry.js';

type Handlers = { [N in JobName]: (data: JobPayloads[N]) => Promise<void> };

export const jobHandlers = (services: Services, logger: Logger): Handlers => ({
  'payment-timeout': paymentTimeout(services.payments),
  'payment-poll': paymentPoll(services.payments),
  'sms-send': smsSend(services.sms),
  'payout-check': payoutCheck(services.payments),
  'auto-release': autoRelease(services.orders, logger),
  'shadow-run': shadowRun(services.shadow),
});

/** Registers every queue and worker with pg-boss, and the recurring auto-release sweep. */
export const startWorkers = async (boss: PgBoss, services: Services, logger: Logger): Promise<void> => {
  const handlers = jobHandlers(services, logger);
  for (const name of JOB_NAMES) {
    await boss.createQueue(name);
    await boss.work<JobPayloads[typeof name]>(name, async jobs => {
      for (const job of jobs) {
        // Errors propagate so pg-boss records the failure and retries per the queue's policy
        await (handlers[name] as (data: unknown) => Promise<void>)(job.data);
      }
    });
  }
  await boss.schedule('auto-release', '*/15 * * * *', {});
  logger.info({ queues: JOB_NAMES }, 'Background workers started');
};
