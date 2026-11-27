import { expectOk, unwrap, type Schemas } from '@nurserylink/api-client';
import type { categoryCreateSchema, categoryUpdateSchema, PageContentKey, pageContentUpdateSchema, partnerCreateSchema, serviceCategoryCreateSchema } from '@nurserylink/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { api } from '../../lib/api';

export type AdminCategory = Schemas['AdminCategory'];
export type ServiceCategory = Schemas['ServiceCategory'];
export type Partner = Schemas['Partner'];
export type PageContent = Schemas['PageContent'];
export type CategoryKind = 'tree' | 'news';

const invalidate = (client: ReturnType<typeof useQueryClient>) => { void client.invalidateQueries({ queryKey: ['admin'] }); };

// ── Categories (trees and news) ────────────────────────────

export const useAdminCategories = (kind: CategoryKind) =>
  useQuery({
    queryKey: ['admin', 'categories', kind],
    queryFn: async () => (await unwrap(kind === 'tree' ? api.GET('/admin/tree-categories', {}) : api.GET('/admin/news-categories', {}))).data,
  });

export const useCreateCategory = (kind: CategoryKind) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: z.input<typeof categoryCreateSchema>) =>
      (await unwrap(kind === 'tree' ? api.POST('/admin/tree-categories', { body }) : api.POST('/admin/news-categories', { body }))).data,
    onSuccess: () => { invalidate(client); },
  });
};

export const useUpdateCategory = (kind: CategoryKind) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ slug, body }: { slug: string; body: z.input<typeof categoryUpdateSchema> }) => {
      const params = { path: { slug } };
      return (await unwrap(kind === 'tree' ? api.PATCH('/admin/tree-categories/{slug}', { params, body }) : api.PATCH('/admin/news-categories/{slug}', { params, body }))).data;
    },
    onSuccess: () => { invalidate(client); },
  });
};

export const useDeleteCategory = (kind: CategoryKind) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (slug: string) => {
      const params = { path: { slug } };
      await expectOk(kind === 'tree' ? api.DELETE('/admin/tree-categories/{slug}', { params }) : api.DELETE('/admin/news-categories/{slug}', { params }));
    },
    onSuccess: () => { invalidate(client); },
  });
};

// ── Expert services ────────────────────────────────────────

export const useAdminServices = () =>
  useQuery({ queryKey: ['admin', 'expert-services'], queryFn: async () => (await unwrap(api.GET('/admin/expert-services', {}))).data });

export const useSaveServiceCategory = (id: string | null) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: z.input<typeof serviceCategoryCreateSchema>) =>
      id
        ? (await unwrap(api.PATCH('/admin/expert-services/{id}', { params: { path: { id } }, body }))).data
        : (await unwrap(api.POST('/admin/expert-services', { body }))).data,
    onSuccess: () => { invalidate(client); },
  });
};

export const useDeleteServiceCategory = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await expectOk(api.DELETE('/admin/expert-services/{id}', { params: { path: { id } } })); },
    onSuccess: () => { invalidate(client); },
  });
};

// ── Partners ───────────────────────────────────────────────

export const useAdminPartners = () =>
  useQuery({ queryKey: ['admin', 'partners'], queryFn: async () => (await unwrap(api.GET('/admin/partners', {}))).data });

export const useSavePartner = (id: string | null) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: z.input<typeof partnerCreateSchema>) =>
      id
        ? (await unwrap(api.PATCH('/admin/partners/{id}', { params: { path: { id } }, body }))).data
        : (await unwrap(api.POST('/admin/partners', { body }))).data,
    onSuccess: () => { invalidate(client); },
  });
};

export const useDeletePartner = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await expectOk(api.DELETE('/admin/partners/{id}', { params: { path: { id } } })); },
    onSuccess: () => { invalidate(client); },
  });
};

// ── Page content ───────────────────────────────────────────

export const useAdminPageContent = () =>
  useQuery({ queryKey: ['admin', 'page-content'], queryFn: async () => (await unwrap(api.GET('/admin/page-content', {}))).data });

export const useSavePageContent = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, body }: { key: PageContentKey; body: z.input<typeof pageContentUpdateSchema> }) =>
      (await unwrap(api.PUT('/admin/page-content/{key}', { params: { path: { key } }, body }))).data,
    onSuccess: () => { invalidate(client); },
  });
};
