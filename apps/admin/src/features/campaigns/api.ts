import { expectOk, unwrap, type Schemas } from '@nurserylink/api-client';
import type { campaignCreateSchema } from '@nurserylink/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { api } from '../../lib/api';

export type Campaign = Schemas['Campaign'];
export type AdminApplication = Schemas['AdminApplication'];
export type CampaignInput = z.output<typeof campaignCreateSchema>;
type ApplicationStatus = AdminApplication['status'];

export const useAdminCampaigns = (page: number) =>
  useQuery({ queryKey: ['admin', 'campaigns', page], queryFn: async () => unwrap(api.GET('/admin/campaigns', { params: { query: { page, limit: 25 } } })), placeholderData: keepPreviousData });

export const useAdminCampaign = (id: string | null) =>
  useQuery({ queryKey: ['admin', 'campaign', id], enabled: id !== null, queryFn: async () => (await unwrap(api.GET('/admin/campaigns/{id}', { params: { path: { id: id ?? '' } } }))).data });

export const useSaveCampaign = (id: string | null) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: CampaignInput) =>
      id ? (await unwrap(api.PATCH('/admin/campaigns/{id}', { params: { path: { id } }, body }))).data : (await unwrap(api.POST('/admin/campaigns', { body }))).data,
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['admin'] }); },
  });
};

export const useDeleteCampaign = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await expectOk(api.DELETE('/admin/campaigns/{id}', { params: { path: { id } } })); },
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['admin'] }); },
  });
};

export const useApplications = (campaignId: string, status: ApplicationStatus | null, page: number) =>
  useQuery({
    queryKey: ['admin', 'applications', campaignId, status, page],
    queryFn: async () => unwrap(api.GET('/admin/campaigns/{id}/applications', { params: { path: { id: campaignId }, query: { page, limit: 25, ...(status ? { status } : {}) } } })),
    placeholderData: keepPreviousData,
  });

export const useReviewApplication = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: 'approved' | 'rejected' | 'collected'; note?: string }) =>
      (await unwrap(api.PUT('/admin/applications/{id}', { params: { path: { id } }, body: { status, ...(note ? { note } : {}) } }))).data,
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['admin'] }); },
  });
};
