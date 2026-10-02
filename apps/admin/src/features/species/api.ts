import { expectOk, unwrap, type Schemas } from '@nurserylink/api-client';
import type { speciesCreateSchema } from '@nurserylink/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { api } from '../../lib/api';

export type SpeciesItem = Schemas['SpeciesListItem'];
export type SpeciesProfile = Schemas['SpeciesProfile'];
export type SpeciesInput = z.output<typeof speciesCreateSchema>;

export const useAdminSpecies = (q: string, category: string | null, page: number, limit = 25) =>
  useQuery({
    queryKey: ['admin', 'species', q, category, page],
    queryFn: async () =>
      unwrap(api.GET('/admin/species', { params: { query: { page, limit, ...(q ? { q } : {}), ...(category ? { category: category as SpeciesProfile['category'] } : {}) } } })),
    placeholderData: keepPreviousData,
  });

export const useAdminSpeciesOne = (id: string | null) =>
  useQuery({
    queryKey: ['admin', 'species-one', id],
    enabled: id !== null,
    queryFn: async () => (await unwrap(api.GET('/admin/species/{id}', { params: { path: { id: id ?? '' } } }))).data,
  });

export const useSaveSpecies = (id: string | null) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: SpeciesInput) =>
      id
        ? (await unwrap(api.PATCH('/admin/species/{id}', { params: { path: { id } }, body }))).data
        : (await unwrap(api.POST('/admin/species', { body }))).data,
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['admin'] }); },
  });
};

export const useDeleteSpecies = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await expectOk(api.DELETE('/admin/species/{id}', { params: { path: { id } } })); },
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['admin'] }); },
  });
};

/** Uploads a photo; the API stores 480 and 960 px WebP versions and returns where. */
export const useUploadMedia = () =>
  useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return (await unwrap(api.POST('/admin/media', { body: { file: '' }, bodySerializer: () => form }))).data;
    },
  });
