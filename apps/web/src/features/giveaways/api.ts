import { unwrap, type Schemas } from '@nurserylink/api-client';
import type { EligibilityAnswers, GiveawayStatus } from '@nurserylink/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type Giveaway = Schemas['Campaign'];
export type Application = Schemas['Application'];

export interface GiveawayFilters {
  status: GiveawayStatus;
  subCounty: string | null;
  purpose: string;
}

/** Giveaways (FR-16): open ones soonest-closing first, or closing soon, or closed. Filters live in the URL. */
export const useGiveaways = (limit = 20, filters: GiveawayFilters = { status: 'open', subCounty: null, purpose: '' }) =>
  useQuery({
    queryKey: ['giveaways', 'list', limit, filters],
    queryFn: async () =>
      unwrap(
        api.GET('/giveaways', {
          params: {
            query: {
              limit,
              status: filters.status,
              ...(filters.subCounty ? { sub_county_id: filters.subCounty } : {}),
              ...(filters.purpose.trim().length >= 1 ? { purpose: filters.purpose.trim() } : {}),
            },
          },
        })
      ),
    placeholderData: keepPreviousData,
  });

export const useGiveaway = (id: string) =>
  useQuery({
    queryKey: ['giveaways', 'one', id],
    queryFn: async () => unwrap(api.GET('/giveaways/{id}', { params: { path: { id } } })),
  });

/** Every sub-county (for the filter), with its district for grouping. */
export const useAllSubCounties = () =>
  useQuery({
    queryKey: ['boundaries', 'sub_county', 'all'],
    queryFn: async () => (await unwrap(api.GET('/boundaries', { params: { query: { level: 'sub_county' } } }))).data,
    staleTime: 24 * 60 * 60_000,
  });

/** The signed-in buyer's applications (personal: never cached offline). */
export const useMyApplications = (enabled: boolean) =>
  useQuery({
    queryKey: ['me', 'applications'],
    enabled,
    queryFn: async () => (await unwrap(api.GET('/giveaways/applications/me', { params: { query: { limit: 100 } } }))).data,
  });

export const useApply = (giveawayId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: { answers: EligibilityAnswers; quantity_requested: number }) =>
      (await unwrap(api.POST('/giveaways/{id}/apply', { params: { path: { id: giveawayId } }, body }))).data,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['me', 'applications'] });
    },
  });
};
