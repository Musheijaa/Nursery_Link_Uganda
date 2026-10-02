import { expectOk, unwrap, type Schemas } from '@nurserylink/api-client';
import type { newsCreateSchema } from '@nurserylink/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { api } from '../../lib/api';

export type AdminNews = Schemas['AdminNews'];
export type NewsInput = z.output<typeof newsCreateSchema>;

export const useAdminNews = (page: number) =>
  useQuery({ queryKey: ['admin', 'news', page], queryFn: async () => unwrap(api.GET('/admin/news', { params: { query: { page, limit: 25 } } })), placeholderData: keepPreviousData });

export const useAdminNewsOne = (id: string | null) =>
  useQuery({ queryKey: ['admin', 'news-one', id], enabled: id !== null, queryFn: async () => (await unwrap(api.GET('/admin/news/{id}', { params: { path: { id: id ?? '' } } }))).data });

export const useSaveNews = (id: string | null) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: NewsInput) =>
      id ? (await unwrap(api.PATCH('/admin/news/{id}', { params: { path: { id } }, body }))).data : (await unwrap(api.POST('/admin/news', { body }))).data,
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['admin'] }); },
  });
};

export const useDeleteNews = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await expectOk(api.DELETE('/admin/news/{id}', { params: { path: { id } } })); },
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['admin'] }); },
  });
};
