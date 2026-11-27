import { toApiError, unwrap, type Schemas } from '@nurserylink/api-client';
import type { EnquiryStatus, EnquiryType } from '@nurserylink/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type AdminEnquiry = Schemas['AdminEnquiry'];

export interface InboxFilter {
  type: EnquiryType | null;
  status: EnquiryStatus | null;
  q: string;
}

const query = (f: InboxFilter) => ({ ...(f.type ? { type: f.type } : {}), ...(f.status ? { status: f.status } : {}), ...(f.q.trim() ? { q: f.q.trim() } : {}) });

/** Everything people sent the team, newest first. Refreshes every minute and on returning to the tab. */
export const useInbox = (filter: InboxFilter, page: number) =>
  useQuery({
    queryKey: ['admin', 'enquiries', filter, page],
    queryFn: async () => unwrap(api.GET('/admin/enquiries', { params: { query: { page, limit: 25, ...query(filter) } } })),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

/** Unread enquiries by type: the sidebar badge and the dashboard. */
export const useInboxCounts = () =>
  useQuery({
    queryKey: ['admin', 'enquiries', 'counts'],
    queryFn: async () => (await unwrap(api.GET('/admin/enquiries/counts', {}))).data,
    refetchInterval: 60_000,
  });

export const useUpdateEnquiry = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: EnquiryStatus; note?: string }) =>
      (await unwrap(api.PUT('/admin/enquiries/{id}', { params: { path: { id } }, body: { status, ...(note ? { note } : {}) } }))).data,
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['admin'] }); },
  });
};

/** The CSV export with the same filters, fetched with the admin's token and saved as a download. */
export const downloadInboxCsv = async (filter: InboxFilter) => {
  const { data, error, response } = await api.GET('/admin/export/enquiries.csv', { params: { query: query(filter) }, parseAs: 'blob' });
  if (!response.ok || !data) throw toApiError(response.status, error);
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
