import { sql } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client.js';

export type ServiceCategoryRow = {
  id: string;
  slug: string;
  title: string;
  intro: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  services: { id: string; title: string; sort_order: number; is_active: boolean }[];
};

/** Expert service categories with their services, in order. Public lists show active ones only. */
export const listServiceCategories = async (db: DbOrTx, activeOnly: boolean, id?: string): Promise<ServiceCategoryRow[]> =>
  (
    await db.execute<ServiceCategoryRow>(sql`
      SELECT c.id, c.slug, c.title, c.intro, c.icon, c.sort_order, c.is_active,
             COALESCE((SELECT json_agg(json_build_object('id', s.id, 'title', s.title, 'sort_order', s.sort_order, 'is_active', s.is_active)
                                       ORDER BY s.sort_order, s.title)
                       FROM services s WHERE s.category_id = c.id ${activeOnly ? sql`AND s.is_active` : sql``}), '[]'::json) AS services
      FROM service_categories c
      WHERE true ${activeOnly ? sql`AND c.is_active` : sql``} ${id ? sql`AND c.id = ${id}` : sql``}
      ORDER BY c.sort_order, c.title`)
  ).rows;

export type PartnerRow = { id: string; name: string; logo_url: string | null; website_url: string | null; sort_order: number; is_active: boolean };

export const listPartners = async (db: DbOrTx, activeOnly: boolean, id?: string): Promise<PartnerRow[]> =>
  (
    await db.execute<PartnerRow>(sql`
      SELECT id, name, logo_url, website_url, sort_order, is_active FROM partners
      WHERE true ${activeOnly ? sql`AND is_active` : sql``} ${id ? sql`AND id = ${id}` : sql``}
      ORDER BY sort_order, name`)
  ).rows;

export type PageContentRow = { key: string; title: string | null; subtitle: string | null; body: string | null; data: Record<string, unknown>; updated_at: Date };

export const listPageContent = async (db: DbOrTx, key?: string): Promise<PageContentRow[]> =>
  (
    await db.execute<PageContentRow>(sql`
      SELECT key, title, subtitle, body, data, updated_at FROM page_content
      ${key ? sql`WHERE key = ${key}` : sql``}
      ORDER BY key`)
  ).rows;
