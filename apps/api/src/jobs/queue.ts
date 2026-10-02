import type PgBoss from 'pg-boss';

/** Every background job and its payload. */
export interface JobPayloads {
  /** Re-check a collection that is still pending 15 minutes after it was requested */
  'payment-timeout': { paymentId: string };
  /** Early status checks after a payment prompt, for when the provider's callback is late or missing */
  'payment-poll': { paymentId: string };
  /** Send one SMS, with retries and backoff */
  'sms-send': { to: string; message: string; orderId?: string };
  /** Check a disbursement or refund; retry it if it failed */
  'payout-check': { paymentId: string };
  /** Hourly sweep: orders dispatched more than 72 hours ago are treated as delivered */
  'auto-release': Record<string, never>;
  /** Compute a Nursery Shadow run */
  'shadow-run': { runId: string };
}

export type JobName = keyof JobPayloads;

export interface SendOptions {
  startAfterSeconds?: number;
  /** Deduplicates: only one queued job per key */
  singletonKey?: string;
}

/** Where services enqueue background work. pg-boss in the app; a recording queue in tests. */
export interface JobQueue {
  send<N extends JobName>(name: N, data: JobPayloads[N], options?: SendOptions): Promise<void>;
}

// Retry policy per job. SMS: 3 attempts with exponential backoff (smsRetry).
const RETRY: Record<JobName, Pick<PgBoss.SendOptions, 'retryLimit' | 'retryDelay' | 'retryBackoff'>> = {
  'payment-timeout': { retryLimit: 5, retryDelay: 60, retryBackoff: true },
  // A missed poll is harmless: the next poll or the 15-minute check picks the payment up
  'payment-poll': { retryLimit: 0 },
  'sms-send': { retryLimit: 2, retryDelay: 30, retryBackoff: true },
  'payout-check': { retryLimit: 5, retryDelay: 60, retryBackoff: true },
  'auto-release': { retryLimit: 0 },
  // A failed run is recorded as failed; the admin starts a new one rather than it retrying silently
  'shadow-run': { retryLimit: 0 },
};

export const JOB_NAMES = Object.keys(RETRY) as JobName[];

export class PgBossQueue implements JobQueue {
  constructor(private readonly boss: PgBoss) {}

  async send<N extends JobName>(name: N, data: JobPayloads[N], options: SendOptions = {}): Promise<void> {
    await this.boss.send(name, data, {
      ...RETRY[name],
      ...(options.startAfterSeconds ? { startAfter: options.startAfterSeconds } : {}),
      ...(options.singletonKey ? { singletonKey: options.singletonKey } : {}),
    });
  }
}

/** Test double: records jobs so tests can inspect them and run them on demand. */
export class RecordingQueue implements JobQueue {
  readonly jobs: { name: JobName; data: unknown; options: SendOptions }[] = [];

  send<N extends JobName>(name: N, data: JobPayloads[N], options: SendOptions = {}): Promise<void> {
    this.jobs.push({ name, data, options });
    return Promise.resolve();
  }

  /** Removes and returns queued jobs with this name. */
  take<N extends JobName>(name: N): JobPayloads[N][] {
    const taken = this.jobs.filter(j => j.name === name);
    for (const job of taken) this.jobs.splice(this.jobs.indexOf(job), 1);
    return taken.map(j => j.data as JobPayloads[N]);
  }
}
