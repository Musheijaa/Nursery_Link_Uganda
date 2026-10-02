import { expectOk, unwrap, type Schemas } from '@nurserylink/api-client';
import type { nurseryCreateSchema } from '@nurserylink/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { api } from '../../lib/api';

export type AdminNursery = Schemas['AdminNursery'];
export type NurseryInput = z.output<typeof nurseryCreateSchema>;
export const PAGE_SIZE = 25;

export interface NurseryFilters {
  q: string;
  district: string | null;
  subCounty: string | null;
  active: 'true' | 'false' | null;
  /** 'real' = not sample data; 'demo' = sample nurseries; 'to_verify' = imported, waiting to be checked */
  show?: 'real' | 'demo' | 'to_verify' | null;
}

export const useAdminNurseries = (f: NurseryFilters, page: number, limit = PAGE_SIZE) =>
  useQuery({
    queryKey: ['admin', 'nurseries', f, page, limit],
    queryFn: async () =>
      unwrap(
        api.GET('/admin/nurseries', {
          params: {
            query: {
              page,
              limit,
              ...(f.q ? { q: f.q } : {}),
              ...(f.district ? { district_id: f.district } : {}),
              ...(f.subCounty ? { sub_county_id: f.subCounty } : {}),
              ...(f.active ? { is_active: f.active } : {}),
              ...(f.show === 'real' ? { is_demo: 'false' as const } : f.show === 'demo' ? { is_demo: 'true' as const } : {}),
              ...(f.show === 'to_verify' ? { to_verify: 'true' as const } : {}),
            },
          },
        })
      ),
    placeholderData: keepPreviousData,
  });

export const useAdminNursery = (id: string | null) =>
  useQuery({
    queryKey: ['admin', 'nursery', id],
    enabled: id !== null,
    queryFn: async () => (await unwrap(api.GET('/admin/nurseries/{id}', { params: { path: { id: id ?? '' } } }))).data,
  });

export const useSaveNursery = (id: string | null) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: NurseryInput) =>
      id
        ? (await unwrap(api.PATCH('/admin/nurseries/{id}', { params: { path: { id } }, body }))).data
        : (await unwrap(api.POST('/admin/nurseries', { body }))).data,
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['admin'] }); },
  });
};

export const useDeleteNursery = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await expectOk(api.DELETE('/admin/nurseries/{id}', { params: { path: { id } } })); },
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['admin'] }); },
  });
};

export const useDistricts = () =>
  useQuery({ queryKey: ['boundaries', 'district'], queryFn: async () => (await unwrap(api.GET('/boundaries', { params: { query: { level: 'district' } } }))).data, staleTime: Infinity });

export const useSubCounties = (district: string | null) =>
  useQuery({
    queryKey: ['boundaries', 'sub_county', district],
    enabled: district !== null,
    queryFn: async () => (await unwrap(api.GET('/boundaries', { params: { query: { level: 'sub_county', parent_id: district ?? undefined } } }))).data,
    staleTime: Infinity,
  });

export const useBoundaryShape = (id: string | null) =>
  useQuery({
    queryKey: ['boundaries', 'shape', id],
    enabled: id !== null,
    queryFn: async () => (await unwrap(api.GET('/boundaries/{id}/geojson', { params: { path: { id: id ?? '' } } }))).data,
    staleTime: Infinity,
  });

/** Every nursery, for pickers (fetched 100 at a time). */
export const useNurseryOptions = () =>
  useQuery({
    queryKey: ['admin', 'nursery-options'],
    queryFn: async () => {
      const all: AdminNursery[] = [];
      for (let page = 1; page <= 50; page++) {
        const r = await unwrap(api.GET('/admin/nurseries', { params: { query: { page, limit: 100 } } }));
        all.push(...r.data);
        if (all.length >= r.meta.total || r.data.length === 0) break;
      }
      return all;
    },
    staleTime: 60_000,
  });
