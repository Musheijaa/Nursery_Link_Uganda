import { z } from 'zod';
import {
  kampalaMonth,
  newsCategorySchema,
  nextSeasonStart,
  seasonOfMonth,
  speciesCategorySchema,
  type OrderStatus,
  type PlantingSeason,
} from '@nurserylink/shared';
import type { Database } from '../../db/client.js';
import type { LatLng } from '../../lib/geo.js';
import type { AssistantTool } from '../../providers/assistant/assistant.js';
import { listRunningCampaigns } from '../campaigns/campaigns.repo.js';
import { toCampaign } from '../campaigns/campaigns.dto.js';
import { listNews } from '../news/news.repo.js';
import type { NurseriesService, NurserySummary } from '../nurseries/nurseries.service.js';
import type { OrdersService } from '../orders/orders.service.js';
import type { SearchService } from '../search/search.service.js';
import type { SpeciesService } from '../species/species.service.js';

export interface ToolDeps {
  db: Database;
  nurseries: NurseriesService;
  species: SpeciesService;
  search: SearchService;
  orders: OrdersService;
}

export interface ToolViewer {
  /** The signed-in buyer, whose own orders the assistant may read */
  buyerId: string | null;
  location: LatLng | null;
  now: Date;
}

const day = (iso: string | Date) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Africa/Kampala' }).format(new Date(iso));
const monthName = (month: number) => new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, month, 15)));

const SEASON_TEXT: Record<PlantingSeason, string> = {
  rains: 'rainy season: the best time to plant',
  prep: 'the month before the rains: order seedlings and prepare holes',
  dry: 'dry season: avoid planting unless you can water',
};

const ORDER_STATUS_TEXT: Record<OrderStatus, string> = {
  pending_payment: 'waiting for the buyer to approve the mobile money payment',
  escrow_held: 'paid (or confirmed); the nursery has been told and is preparing it',
  dispatched: 'on the way, or ready to collect',
  delivered: 'delivered; the nursery is being paid',
  released: 'completed: the nursery has been paid',
  disputed: 'disputed: the team is looking into it',
  refunded: 'refunded',
  cancelled: 'cancelled (the payment was not approved in time); nothing was charged',
};

/** The month and planting season in Kampala, for the per-request facts too. */
export const seasonNow = (now: Date) => {
  const month = kampalaMonth(now);
  return { month: monthName(month), season: SEASON_TEXT[seasonOfMonth(month)] };
};

const nurseryResult = (n: NurserySummary) => ({
  name: n.name,
  link: `/nurseries?nursery=${n.id}`,
  nursery_id: n.id,
  place: `${n.sub_county.name}, ${n.district.name}`,
  kinds_of_trees_in_stock: n.species_count,
  seedlings_in_stock: n.total_stock,
  certification: n.certification_status,
  free_seedlings_campaign: n.has_active_campaign,
  ...(n.is_demo ? { sample: 'SAMPLE nursery: invented demonstration data, do not travel there or pay' } : {}),
  ...(typeof n.road_km === 'number' ? { distance_km_by_road: n.road_km } : n.straight_km !== undefined ? { distance_km_straight_line: n.straight_km } : {}),
});

/** Types `run`'s input from the tool's own schema (the service validates it before running). */
const tool = <S extends z.ZodObject>(definition: AssistantTool<S>): AssistantTool => definition;

/**
 * The look-ups the assistant may make: read-only, over the same services the public pages use,
 * so it sees exactly what visitors see (active nurseries only, sample nurseries flagged, no
 * private phone numbers). `my_orders` exists only for a signed-in buyer, and only their own.
 */
export const assistantTools = (deps: ToolDeps, viewer: ToolViewer): AssistantTool[] => {
  const tools: AssistantTool[] = [
    tool({
      name: 'search_nurseries',
      label: 'Looking up nurseries…',
      description:
        'Find tree-seedling nurseries on the site. Filter by a tree or nursery name (common, scientific or local names, spelling mistakes tolerated), by a place in Uganda (district or sub-county name), by kind of tree, or to those giving free seedlings. With near_me (only when the person\'s location is known) the closest come first with road distances. Returns up to 8 nurseries with links; use get_nursery for one nursery\'s stock and prices.',
      input: z.object({
        query: z.string().trim().min(1).max(100).optional().describe('A tree or nursery name, e.g. "mvule", "mango", "Kiwanga"'),
        place: z.string().trim().min(2).max(100).optional().describe('A district or sub-county name, e.g. "Mukono", "Goma Division"'),
        category: speciesCategorySchema.optional().describe('Only nurseries stocking this kind of tree'),
        free_seedlings: z.boolean().optional().describe('Only nurseries running a free-seedling campaign now'),
        near_me: z.boolean().optional().describe('Closest to the person first (needs their location)'),
      }),
      run: async input => {
        let place: { id: string; level: string; label: string } | null = null;
        if (input.place) {
          const found = (await deps.search.suggest(input.place, ['place'], 1))[0];
          if (found?.kind === 'place') place = { id: found.id, level: found.level, label: found.parent_name ? `${found.label}, ${found.parent_name}` : found.label };
          else return { results: [], note: `No district or sub-county called "${input.place}" was found.` };
        }
        const nearest = input.near_me === true && viewer.location !== null;
        const result = await deps.nurseries.list({
          filters: {
            q: input.query,
            category: input.category,
            hasCampaign: input.free_seedlings === true ? true : undefined,
            districtId: place?.level === 'district' ? place.id : undefined,
            subCountyId: place?.level === 'sub_county' ? place.id : undefined,
          },
          point: viewer.location ?? undefined,
          sort: nearest ? 'nearest' : 'name',
          page: 1,
          limit: 8,
        });
        return {
          total_matching: result.meta.total,
          ...(place ? { place: place.label } : {}),
          ...(result.meta.corrected_q ? { spelling_corrected_to: result.meta.corrected_q } : {}),
          ...(input.near_me === true && viewer.location === null ? { note: 'The person\'s location is not known, so these are not sorted by distance.' } : {}),
          results: result.items.map(nurseryResult),
          browse_link: `/nurseries${input.query ? `?q=${encodeURIComponent(input.query)}` : ''}`,
        };
      },
    }),
    tool({
      name: 'get_nursery',
      label: 'Checking the nursery’s stock…',
      description: 'One nursery\'s details: where it is, its phone number, every tree it has in stock with quantity and price per seedling (UGX), and its free-seedling campaigns. Use a nursery_id from search_nurseries.',
      input: z.object({ nursery_id: z.uuid() }),
      run: async ({ nursery_id }) => {
        const n = await deps.nurseries.profile(nursery_id, viewer.location ?? undefined);
        return {
          ...nurseryResult(n),
          type: n.type,
          operator: n.operator_name,
          phone: n.contact_phone,
          ...(n.distance_km !== undefined ? { distance_km: n.distance_km, distance_kind: n.distance_mode === 'road' ? 'by road' : 'straight line (approx.)' } : {}),
          order_link: `/nurseries/${n.id}/order`,
          stock: n.inventory
            .filter(i => i.quantity_available > 0)
            .map(i => ({ tree: i.species.common_name, tree_link: `/library/${i.species.slug}`, quantity: i.quantity_available, price_ugx: i.unit_price })),
          free_seedling_campaigns: n.active_campaigns.map(c => ({ title: c.title, link: `/free-seedlings/${c.id}`, seedlings_left: c.remaining_stock, closes: day(c.ends_at) })),
          stock_last_updated: n.stock_updated_at ? day(n.stock_updated_at) : null,
        };
      },
    }),
    tool({
      name: 'search_trees',
      label: 'Searching the tree library…',
      description: 'Search the site\'s tree library by name (common, scientific or local, spelling mistakes tolerated) or by kind (indigenous, agroforestry, exotic, ornamental, medicinal, coffee, cocoa). Leave both empty to list every tree. Returns up to 15 trees with links and how many nurseries stock each.',
      input: z.object({
        query: z.string().trim().min(1).max(100).optional(),
        category: speciesCategorySchema.optional(),
      }),
      run: async input => {
        const { items, meta } = await deps.species.list({ q: input.query, category: input.category }, { page: 1, limit: 15 });
        return {
          total_matching: meta.total,
          ...(meta.corrected_q ? { spelling_corrected_to: meta.corrected_q } : {}),
          results: items.map(s => ({
            name: s.common_name,
            slug: s.slug,
            link: `/library/${s.slug}`,
            scientific_name: s.scientific_name,
            local_names: s.local_names.map(l => `${l.name} (${l.language})`),
            category: s.category,
            growth: s.growth_pace,
            nurseries_with_stock: s.nursery_count,
          })),
        };
      },
    }),
    tool({
      name: 'get_tree',
      label: 'Reading about the tree…',
      description: 'Everything the tree library says about one tree: local names, how fast and tall it grows, canopy and root notes, where in Uganda it grows, the price range at nurseries and the National Forestry Authority reference price. Use a slug from search_trees.',
      input: z.object({ slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/) }),
      run: async ({ slug }) => {
        const s = await deps.species.profile(slug);
        return {
          name: s.common_name,
          link: `/library/${s.slug}`,
          find_nurseries_link: `/nurseries?species=${s.slug}`,
          scientific_name: s.scientific_name,
          local_names: s.local_names.map(l => `${l.name} (${l.language})`),
          category: s.category,
          growth: s.growth_pace,
          height_over_time: s.height_timeline.map(h => `${String(h.height_m)} m after ${String(h.years)} years`),
          canopy: s.canopy_notes,
          roots: s.root_notes,
          grows_in: s.ecological_zones,
          nurseries_with_stock: s.nursery_count,
          price_at_nurseries_ugx: s.min_price === null ? null : { lowest: s.min_price, highest: s.max_price },
          nfa_reference_price: s.reference_price ? { ugx: s.reference_price.ugx, pot_inches: s.reference_price.pot_inches, source: 'National Forestry Authority price list, January 2024' } : null,
        };
      },
    }),
    tool({
      name: 'list_free_seedling_campaigns',
      label: 'Looking for free seedlings…',
      description: 'Free-seedling campaigns running now (giveaways by nurseries and partners), soonest-closing first: what trees, how many are left, who can apply (conditions), where to collect, and the closing date. Optionally filter by words in the purpose, e.g. "school" or "coffee".',
      input: z.object({ purpose: z.string().trim().min(2).max(100).optional() }),
      run: async ({ purpose }) => {
        const rows = await listRunningCampaigns(deps.db, { purpose }, 10, 0);
        return {
          results: rows.map(toCampaign).map(c => ({
            title: c.title,
            link: `/free-seedlings/${c.id}`,
            open_for_applications: c.is_open,
            funder: `${c.funder_name} (${c.funder_type})`,
            purpose: c.purpose,
            trees: c.species.map(s => s.common_name),
            seedlings_left: c.remaining_stock,
            of: c.allocated_stock,
            area: c.sub_county.name,
            collect_at: c.pickup_nursery.name,
            closes: day(c.ends_at),
            conditions: c.eligibility_rules.map(r => `${r.label}${r.required ? ' (required)' : ''}`),
          })),
          all_campaigns_link: '/free-seedlings',
        };
      },
    }),
    tool({
      name: 'latest_advice',
      label: 'Checking the latest advice…',
      description: 'The newest posts in News & advice (weather, market prices, policy, grants), with a short excerpt and link.',
      input: z.object({ category: newsCategorySchema.optional() }),
      run: async ({ category }) => {
        const rows = await listNews(deps.db, category, 5, 0);
        return {
          results: rows.map(p => ({ title: p.title, link: `/news/${p.slug}`, category: p.category, published: day(p.published_at), excerpt: p.excerpt })),
        };
      },
    }),
    tool({
      name: 'planting_calendar',
      label: 'Checking the planting calendar…',
      description: 'The planting season this month in central Uganda and when the next rains start. Use it for any "when should I plant" question.',
      input: z.object({}),
      run: () => {
        const month = kampalaMonth(viewer.now);
        const season = seasonOfMonth(month);
        const next = nextSeasonStart(month, 'rains');
        const advice =
          season === 'rains' && seasonOfMonth(month + 1) !== 'rains' ? `It is ${monthName(month)}, the last month of the rains. Plant now only if you can water the seedlings through the dry months; otherwise get ready for the rains that start in ${monthName(next)}.`
          : season === 'rains' ? `It is ${monthName(month)}, the rainy season: a good time to plant. Plant early in the season so roots are deep before the dry months.`
          : season === 'prep' ? `It is ${monthName(month)}: the rains usually start in ${monthName(next)}. Order your seedlings and dig the holes now.`
          : `It is ${monthName(month)}, a dry month. The next rains usually start in ${monthName(next)}; order seedlings the month before. Plant now only if you can water.`;
        return Promise.resolve({ month: monthName(month), season: SEASON_TEXT[season], next_rains_start: monthName(next), advice, calendar_link: '/news' });
      },
    }),
  ];

  if (viewer.buyerId) {
    const buyerId = viewer.buyerId;
    tools.push(
      tool({
        name: 'my_orders',
        label: 'Checking your orders…',
        description: 'The signed-in buyer\'s own recent orders (newest first): code, status, nursery, seedlings and total.',
        input: z.object({}),
        run: async () => {
          const { items, meta } = await deps.orders.listMine(buyerId, { page: 1, limit: 5 });
          return {
            total_orders: meta.total,
            results: items.map(o => ({
              name: `Order ${o.short_code}`,
              link: `/orders/${o.id}`,
              status: ORDER_STATUS_TEXT[o.status],
              nursery: o.nursery.name,
              nursery_phone: o.nursery.contact_phone,
              seedlings: o.items.map(i => `${String(i.quantity)} × ${i.species.common_name}`),
              total_ugx: o.grand_total,
              delivery: o.delivery_type === 'order_and_deliver' ? 'delivery' : 'collection',
              ordered: day(o.created_at),
            })),
            all_orders_link: '/orders',
          };
        },
      })
    );
  }
  return tools;
};
