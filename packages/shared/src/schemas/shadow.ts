import { z } from 'zod';

/** Hansen Global Forest Change starts in 2001. */
export const FOREST_LOSS_FIRST_YEAR = 2001;

export const shadowRunCreateSchema = z.object({
  /** A 1 km cell counts as "losing forest" at or above this share of its area lost since since_year */
  threshold_pct: z.number().gt(0).max(100),
  since_year: z.number().int().min(FOREST_LOSS_FIRST_YEAR).max(2100),
});
export type ShadowRunCreate = z.infer<typeof shadowRunCreateSchema>;

/** Stored in shadow_runs.params. inputs_hash fingerprints the nurseries and forest-loss data a run used. */
export type ShadowRunParams = ShadowRunCreate & { inputs_hash?: string };

/**
 * zones: each nursery's 5/10/20 km service areas. shadows: the dissolved shadow zones.
 * cells: the 1 km forest-loss cells behind them (summed from since_year), only those at or above
 * half the threshold, each marked whether it lies in a shadow.
 */
export const shadowLayerSchema = z.enum(['zones', 'shadows', 'cells']);
export type ShadowLayer = z.infer<typeof shadowLayerSchema>;
