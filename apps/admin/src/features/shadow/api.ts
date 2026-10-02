import { toApiError, unwrap, type Schemas } from '@nurserylink/api-client';
import type { ShadowLayer, ShadowRunCreate } from '@nurserylink/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type ShadowRun = Schemas['ShadowRun'];

const unfinished = (run: ShadowRun | undefined) => run?.status === 'queued' || run?.status === 'running';

export const useShadowRuns = (page: number) =>
  useQuery({
    queryKey: ['admin', 'shadow-runs', page],
    queryFn: async () => unwrap(api.GET('/admin/shadow/runs', { params: { query: { page, limit: 10 } } })),
    placeholderData: keepPreviousData,
    // Keep the list's statuses fresh while a run is working
    refetchInterval: q => (q.state.data?.data.some(unfinished) ? 3000 : false),
  });

export const useShadowRun = (id: string | null) =>
  useQuery({
    queryKey: ['admin', 'shadow-run', id],
    enabled: id !== null,
    queryFn: async () => (await unwrap(api.GET('/admin/shadow/runs/{id}', { params: { path: { id: id ?? '' } } }))).data,
    refetchInterval: q => (unfinished(q.state.data) ? 3000 : false),
  });

/** One map layer of a finished run; results never change, so it is cached for the session. */
export const useShadowLayer = (run: ShadowRun | undefined, layer: ShadowLayer, enabled: boolean) =>
  useQuery({
    queryKey: ['admin', 'shadow-layer', run?.id, layer],
    enabled: enabled && run?.status === 'succeeded',
    queryFn: async () => (await unwrap(api.GET('/admin/shadow/runs/{id}/geojson', { params: { path: { id: run?.id ?? '' }, query: { layer } } }))).data,
    staleTime: Infinity,
  });

export const useStartRun = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: ShadowRunCreate) => unwrap(api.POST('/admin/shadow/runs', { body })),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['admin', 'shadow-runs'] }); },
  });
};

/** The latest forest-loss load (from the audit log): where the data came from and when. */
export const useForestLossSource = () =>
  useQuery({
    queryKey: ['admin', 'forest-loss-source'],
    queryFn: async () => (await unwrap(api.GET('/admin/audit-log', { params: { query: { action: 'forest_loss.load', limit: 1 } } }))).data[0] ?? null,
  });

/** A map layer as the client returns it (openapi-fetch widens coordinate tuples to number[]). */
export type LayerCollection = NonNullable<ReturnType<typeof useShadowLayer>['data']>;

/** Downloads a run's shadow zones as a GeoJSON file (the export needs the admin's token, so no plain link). */
export const downloadShadowGeoJson = async (runId: string) => {
  const { data, error, response } = await api.GET('/admin/export/shadow/{runId}.geojson', { params: { path: { runId } }, parseAs: 'blob' });
  if (!response.ok || !data) throw toApiError(response.status, error);
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nursery-shadow-${runId.slice(0, 8)}.geojson`;
  a.click();
  URL.revokeObjectURL(url);
};
