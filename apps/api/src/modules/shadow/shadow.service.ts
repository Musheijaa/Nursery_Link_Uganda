import type { Logger } from 'pino';
import type { PaginationMeta, ShadowLayer, ShadowRunCreate } from '@nurserylink/shared';
import type { Database } from '../../db/client.js';
import type { JobQueue } from '../../jobs/queue.js';
import { writeAudit } from '../../lib/audit.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { paginationMeta, toOffset, type Pagination } from '../../lib/pagination.js';
import type { RoutingProvider } from '../../providers/routing/routing.js';
import * as repo from './shadow.repo.js';

/** Service-area distances by road, in km (service_zones.km). 20 km defines "served". */
export const SERVICE_KMS = [5, 10, 20] as const;

const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

export const toRunDto = (r: repo.RunRow) => ({
  id: r.id,
  status: r.status,
  params: { threshold_pct: r.params.threshold_pct, since_year: r.params.since_year },
  started_by: r.started_by,
  created_at: new Date(r.created_at).toISOString(),
  started_at: iso(r.started_at),
  finished_at: iso(r.finished_at),
  error: r.error,
  summary: { nurseries: r.nurseries, shadow_zones: r.shadow_zones, shadow_area_km2: Math.round(r.shadow_area_km2 * 1000) / 1000 },
});
export type RunDto = ReturnType<typeof toRunDto>;

export interface StartResult {
  run: RunDto;
  /** new: queued now · in_progress: an identical run is already queued or running · cached: reused, nothing changed */
  outcome: 'new' | 'in_progress' | 'cached';
  warnings: string[];
}

/**
 * The Nursery Shadow: areas losing forest that no nursery can serve within 20 km by road.
 * Runs are computed in the background (the shadow-run job) and cached until the inputs change.
 */
export class ShadowService {
  constructor(private readonly deps: { db: Database; routing: RoutingProvider; queue: JobQueue; logger: Logger }) {}

  async start(actorId: string, params: ShadowRunCreate): Promise<StartResult> {
    const { db, queue } = this.deps;
    const warnings = (await repo.countForestLossCells(db)) === 0
      ? ['No forest-loss data is loaded, so the run will find no shadows. Load it with scripts/forest-loss first.']
      : [];

    const hash = await repo.inputsHash(db);
    const cached = await repo.findReusableRun(db, params, hash);
    if (cached) return { run: toRunDto(cached), outcome: 'cached', warnings };
    const active = await repo.findActiveRun(db, params);
    if (active) return { run: toRunDto(active), outcome: 'in_progress', warnings };

    const runId = await db.transaction(async tx => {
      const id = await repo.insertRun(tx, params, actorId);
      await writeAudit(tx, { actorId, action: 'shadow.run_requested', entity: 'shadow_run', entityId: id, after: params });
      return id;
    });
    await queue.send('shadow-run', { runId }, { singletonKey: `shadow:${runId}` });
    return { run: await this.get(runId), outcome: 'new', warnings };
  }

  /**
   * The shadow-run job. Builds 5/10/20 km service areas for every active nursery, then the shadow
   * zones. A failure marks the run failed (with the reason) and removes its partial results.
   */
  async execute(runId: string): Promise<void> {
    const { db, routing, logger } = this.deps;
    const run = await repo.findRun(db, runId);
    if (!run) return;
    if (!(await repo.markRunning(db, runId, await repo.inputsHash(db)))) return;

    try {
      await repo.clearRunResults(db, runId);
      const nurseries = await repo.activeNurseries(db);
      for (const nursery of nurseries) {
        const areas = await routing.isochrone({ lat: nursery.lat, lng: nursery.lng }, [...SERVICE_KMS]);
        for (const area of areas) await repo.insertServiceZone(db, runId, nursery.id, area.km, area.points);
      }
      await repo.buildShadows(db, runId, run.params);
      await repo.markFinished(db, runId, 'succeeded', null);
      logger.info({ runId, nurseries: nurseries.length }, 'Nursery Shadow run finished');
    } catch (err) {
      logger.error({ err, runId }, 'Nursery Shadow run failed');
      await repo.clearRunResults(db, runId);
      await repo.markFinished(db, runId, 'failed', err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  async list(page: Pagination): Promise<{ items: RunDto[]; meta: PaginationMeta }> {
    const rows = await repo.listRuns(this.deps.db, page.limit, toOffset(page));
    return { items: rows.map(toRunDto), meta: paginationMeta(page, rows[0]?.total ?? 0) };
  }

  async get(id: string): Promise<RunDto> {
    const run = await repo.findRun(this.deps.db, id);
    if (!run) throw new NotFoundError('Shadow run not found');
    return toRunDto(run);
  }

  async layer(id: string, layer: ShadowLayer): Promise<repo.LayerCollection> {
    const run = await this.get(id);
    if (run.status !== 'succeeded') throw new ConflictError(`This run is ${run.status}; its map is available once it has succeeded`, { status: run.status });
    return repo.layerGeoJson(this.deps.db, id, layer, run.params);
  }
}
