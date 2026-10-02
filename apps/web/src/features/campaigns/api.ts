import { unwrap, type Schemas } from '@nurserylink/api-client';
import type { EligibilityAnswers } from '@nurserylink/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type Campaign = Schemas['Campaign'];
export type Application = Schemas['Application'];

export interface CampaignFilters {
  subCounty: string | null;
  purpose: string;
}

/** Running free-seedling campaigns (FR-16), soonest-closing first. */
export const useCampaigns = (limit = 20, filters: CampaignFilters = { subCounty: null, purpose: '' }) =>
  useQuery({
    queryKey: ['campaigns', 'list', limit, filters],
    queryFn: async () =>
      unwrap(
        api.GET('/campaigns', {
          params: {
            query: {
              limit,
              ...(filters.subCounty ? { sub_county_id: filters.subCounty } : {}),
              ...(filters.purpose.trim().length >= 2 ? { purpose: filters.purpose.trim() } : {}),
            },
          },
        })
      ),
    placeholderData: keepPreviousData,
  });

export const useCampaign = (id: string) =>
  useQuery({
    queryKey: ['campaigns', 'one', id],
    queryFn: async () => unwrap(api.GET('/campaigns/{id}', { params: { path: { id } } })),
  });

/** Every sub-county (for the campaign filter), with its district for grouping. */
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
    queryFn: async () => (await unwrap(api.GET('/campaigns/applications/me', { params: { query: { limit: 100 } } }))).data,
  });

export const useApply = (campaignId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: { answers: EligibilityAnswers; quantity_requested: number }) =>
      (await unwrap(api.POST('/campaigns/{id}/apply', { params: { path: { id: campaignId } }, body }))).data,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['me', 'applications'] });
    },
  });
};
