import { unwrap } from '@nurserylink/api-client';
import type { NewsCategory } from '@nurserylink/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export const NEWS_PAGE_SIZE = 10;

export const useNewsList = (category: NewsCategory | null, page: number, limit = NEWS_PAGE_SIZE) =>
  useQuery({
    queryKey: ['news', 'list', category, page, limit],
    queryFn: async () => unwrap(api.GET('/news', { params: { query: { page, limit, ...(category ? { category } : {}) } } })),
    placeholderData: keepPreviousData,
  });

export const useNewsPost = (slug: string) =>
  useQuery({
    queryKey: ['news', 'post', slug],
    queryFn: async () => unwrap(api.GET('/news/{slug}', { params: { path: { slug } } })),
  });
