import { unwrap, type Schemas } from '@nurserylink/api-client';
import type { EnquiryCreate, PageContentKey } from '@nurserylink/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { en } from '../../copy/en';
import { api } from '../../lib/api';

export type ServiceCategory = Schemas['ServiceCategory'];
export type Partner = Schemas['Partner'];

export interface PageCopy {
  title: string | null;
  subtitle: string | null;
  /** Plain paragraphs (or Markdown on the Donate page) */
  body: string | null;
  data: Record<string, unknown>;
}

const pageContent = {
  queryKey: ['page-content'],
  queryFn: async () => (await unwrap(api.GET('/page-content', {}))).data,
  staleTime: 10 * 60_000,
};

/**
 * One block of site copy. Admins edit it in the console; until it loads (or if the API has no such
 * block) the client's wording from copy/en.ts shows, so pages never wait for it or show blanks.
 */
export const usePageCopy = (key: PageContentKey): PageCopy => {
  const query = useQuery({ ...pageContent, select: blocks => blocks.find(b => b.key === key) });
  const fallback = en.content[key];
  const block = query.data;
  if (!block) return fallback;
  return {
    title: block.title ?? fallback.title,
    subtitle: block.subtitle,
    body: block.body,
    data: Object.keys(block.data).length ? block.data : fallback.data,
  };
};

/** Splits copy into paragraphs (blank lines) and lines (single line breaks), for plain rendering */
export const paragraphs = (text: string | null): string[][] =>
  (text ?? '').split(/\n{2,}/).map(p => p.split('\n').filter(Boolean)).filter(p => p.length > 0);

export const useExpertServices = () =>
  useQuery({ queryKey: ['expert-services'], queryFn: async () => (await unwrap(api.GET('/expert-services', {}))).data, staleTime: 10 * 60_000 });

export const usePartners = () =>
  useQuery({ queryKey: ['partners'], queryFn: async () => (await unwrap(api.GET('/partners', {}))).data, staleTime: 10 * 60_000 });

export const useTreeCategories = () =>
  useQuery({ queryKey: ['tree-categories'], queryFn: async () => (await unwrap(api.GET('/tree-categories', {}))).data, staleTime: 10 * 60_000 });

export const useNewsCategories = () =>
  useQuery({ queryKey: ['news-categories'], queryFn: async () => (await unwrap(api.GET('/news/categories', {}))).data, staleTime: 10 * 60_000 });

/** Expert Services requests and the Donate page's donation, partnership and contact forms */
export const useSendEnquiry = () =>
  useMutation({ mutationFn: async (body: EnquiryCreate) => (await unwrap(api.POST('/enquiries', { body }))).data });
