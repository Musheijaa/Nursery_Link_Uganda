import { z } from 'zod';
import type { PaginationMeta } from '@nurserylink/shared';

export const MAX_PAGE_SIZE = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
});

export type Pagination = z.infer<typeof paginationQuerySchema>;

export const toOffset = ({ page, limit }: Pagination) => (page - 1) * limit;

export const paginationMeta = ({ page, limit }: Pagination, total: number): PaginationMeta => ({ page, limit, total });
