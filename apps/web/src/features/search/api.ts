import { unwrap, type Schemas } from '@nurserylink/api-client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type Suggestion = Schemas['Suggestion'];
export type SuggestionKind = Suggestion['kind'];
export type Place = Schemas['Place'];

/** Suggestions for what's typed so far (trees, nurseries, places), forgiving spelling mistakes. */
export const useSuggestions = (q: string, types: readonly SuggestionKind[], enabled = true) =>
  useQuery({
    queryKey: ['search', 'suggest', q, types],
    enabled: enabled && q.length >= 2,
    queryFn: async () => unwrap(api.GET('/search/suggest', { params: { query: { q, types: types.join(','), limit: 8 } } })),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });

/**
 * Places by name, including villages and landmarks from OpenStreetMap. Only run when the person
 * asks (OpenStreetMap's free service doesn't allow search-as-you-type).
 */
export const usePlaces = (q: string | null) =>
  useQuery({
    queryKey: ['search', 'places', q],
    enabled: q !== null && q.length >= 2,
    queryFn: async () => unwrap(api.GET('/places', { params: { query: { q: q ?? '' } } })),
    staleTime: 60 * 60_000,
  });
