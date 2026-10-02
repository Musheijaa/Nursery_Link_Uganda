import { expectOk, unwrap, type Schemas } from '@nurserylink/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type InventoryLine = Schemas['InventoryLine'];
export type ImportResult = Schemas['ImportResult'];

export const useInventory = (nurseryId: string | null) =>
  useQuery({
    queryKey: ['admin', 'inventory', nurseryId],
    enabled: nurseryId !== null,
    queryFn: async () => (await unwrap(api.GET('/admin/nurseries/{id}/inventory', { params: { path: { id: nurseryId ?? '' } } }))).data,
  });

/** Every species (for pickers), fetched 100 at a time. */
export const useSpeciesOptions = () =>
  useQuery({
    queryKey: ['admin', 'species-options'],
    queryFn: async () => {
      const all: Schemas['SpeciesListItem'][] = [];
      for (let page = 1; page <= 50; page++) {
        const r = await unwrap(api.GET('/admin/species', { params: { query: { page, limit: 100 } } }));
        all.push(...r.data);
        if (all.length >= r.meta.total || r.data.length === 0) break;
      }
      return all;
    },
    staleTime: 60_000,
  });

const useInvalidate = () => {
  const client = useQueryClient();
  return () => { void client.invalidateQueries({ queryKey: ['admin'] }); };
};

export const useUpdateLine = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, quantity_available, unit_price }: { id: string; quantity_available: number; unit_price: number }) =>
      (await unwrap(api.PATCH('/admin/inventory/{id}', { params: { path: { id } }, body: { quantity_available, unit_price } }))).data,
    onSuccess: invalidate,
  });
};

export const useAddLine = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (body: { nursery_id: string; species_id: string; quantity_available: number; unit_price: number }) =>
      (await unwrap(api.POST('/admin/inventory', { body }))).data,
    onSuccess: invalidate,
  });
};

export const useDeleteLine = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => { await expectOk(api.DELETE('/admin/inventory/{id}', { params: { path: { id } } })); },
    onSuccess: invalidate,
  });
};

/** CSV import: a dry run unless commit is true. A file with row errors comes back as a 400 with the result in details. */
export const useImportCsv = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ csv, commit }: { csv: string; commit: boolean }) =>
      (
        await unwrap(
          api.POST('/admin/inventory/import', {
            params: { query: { commit: commit ? 'true' : 'false' } },
            body: csv,
            bodySerializer: (b: string) => b,
            headers: { 'Content-Type': 'text/csv' },
          })
        )
      ).data,
    onSuccess: invalidate,
  });
};
