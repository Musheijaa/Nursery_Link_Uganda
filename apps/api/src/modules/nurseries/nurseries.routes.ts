import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { paginationQuerySchema } from '../../lib/pagination.js';
import { optionalLatLngQuery } from '../../lib/geo.js';
import type { NurseriesService } from './nurseries.service.js';
import { categoryListParam } from '../species/species.routes.js';

/** GeoJSON is for the map: one unpaginated collection (capped) rather than pages */
export const GEOJSON_MAX_FEATURES = 2000;

const booleanParam = z.enum(['true', 'false']).transform(v => v === 'true');

export const listNurseriesQuery = z
  .object({
    district_id: z.uuid().optional(),
    sub_county_id: z.uuid().optional(),
    species: z.string().trim().min(2).max(100).optional(),
    /** Nurseries with at least one tree in any of these categories in stock: "fruit,timber" */
    categories: categoryListParam.optional(),
    /** true: certified (verified by an admin); false: uncertified */
    certified: booleanParam.optional(),
    q: z.string().trim().min(1).max(100).optional(),
    has_campaign: booleanParam.optional(),
    format: z.enum(['json', 'geojson']).default('json'),
    sort: z.enum(['name', 'nearest']).default('name'),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
  })
  .extend(paginationQuerySchema.shape)
  .superRefine((q, ctx) => {
    if ((q.lat === undefined) !== (q.lng === undefined)) ctx.addIssue({ code: 'custom', path: ['lat'], message: 'Provide both lat and lng, or neither' });
    if (q.sort === 'nearest' && q.lat === undefined) ctx.addIssue({ code: 'custom', path: ['sort'], message: 'sort=nearest needs lat and lng' });
  });

const idParams = z.object({ id: z.uuid() });

export const nurseriesRoutes = (service: NurseriesService): Router => {
  const router = Router();

  router.get('/', validate({ query: listNurseriesQuery }), async (_req, res) => {
    const q = (res.locals.validated as { query: z.output<typeof listNurseriesQuery> }).query;
    const point = q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : undefined;
    const filters = { districtId: q.district_id, subCountyId: q.sub_county_id, species: q.species, categories: q.categories, certified: q.certified, q: q.q, hasCampaign: q.has_campaign };
    const geojson = q.format === 'geojson';

    const result = await service.list({
      filters,
      point,
      sort: q.sort,
      page: geojson ? 1 : q.page,
      limit: geojson && q.sort !== 'nearest' ? GEOJSON_MAX_FEATURES : q.limit,
    });

    if (geojson) {
      const { total, distance_mode, corrected_q } = result.meta;
      res.json({ data: service.toGeoJson(result.items), meta: { total, ...(distance_mode ? { distance_mode } : {}), ...(corrected_q ? { corrected_q } : {}) } });
      return;
    }
    res.json({ data: result.items, meta: result.meta });
  });

  router.get('/:id', validate({ params: idParams, query: optionalLatLngQuery }), async (_req, res) => {
    const { params, query } = res.locals.validated as { params: z.output<typeof idParams>; query: z.output<typeof optionalLatLngQuery> };
    const point = query.lat !== undefined && query.lng !== undefined ? { lat: query.lat, lng: query.lng } : undefined;
    res.json({ data: await service.profile(params.id, point) });
  });


  return router;
};
