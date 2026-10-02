import { unwrap, type Schemas } from '@nurserylink/api-client';
import type { SpeciesCategory } from '@nurserylink/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type SpeciesItem = Schemas['SpeciesListItem'];

/**
 * The whole index (the library is small: tens of trees), fetched 100 at a time so the A–Z
 * index and letter jumps work without paging.
 */
export const useSpeciesIndex = (category: SpeciesCategory | null, q: string) =>
  useQuery({
    queryKey: ['species', 'index', category, q],
    queryFn: async () => {
      const items: SpeciesItem[] = [];
      let fromCache = false;
      let fetchedAt: Date | null = null;
      let correctedQ: string | undefined;
      for (let page = 1; page <= 20; page++) {
        const result = await unwrap(
          api.GET('/species', { params: { query: { page, limit: 100, ...(category ? { category } : {}), ...(q ? { q } : {}) } } })
        );
        items.push(...result.data);
        correctedQ ??= result.meta.corrected_q;
        fromCache ||= result.fromCache;
        fetchedAt ??= result.fetchedAt;
        if (items.length >= result.meta.total || result.data.length === 0) break;
      }
      return { items, fromCache, fetchedAt, correctedQ };
    },
    placeholderData: keepPreviousData,
  });

export const useSpeciesProfile = (slug: string) =>
  useQuery({
    queryKey: ['species', 'profile', slug],
    queryFn: async () => unwrap(api.GET('/species/{slug}', { params: { path: { slug } } })),
  });
