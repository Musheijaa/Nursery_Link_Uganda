import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Every /nurseries filter lives in the URL, so any view can be shared or bookmarked, and the
 * Library's "Find nurseries near me" deep link works: /nurseries?species=mvule&sort=nearest
 */
export interface NurseryParams {
  q: string;
  district: string | null;
  subCounty: string | null;
  species: string | null;
  /** Nurseries stocking a tree in any of these categories (?categories=fruit,timber) */
  categories: string[];
  /** Certified (verified by an admin) or uncertified nurseries only (?certified=true|false) */
  certified: boolean | null;
  sort: 'name' | 'nearest';
  view: 'map' | 'list';
  /** The open nursery card */
  nursery: string | null;
  /** Directions drawn for the open nursery */
  directions: boolean;
}

const KEYS = { q: 'q', district: 'district', subCounty: 'sub_county', species: 'species', categories: 'categories', certified: 'certified', sort: 'sort', view: 'view', nursery: 'nursery', directions: 'directions' } as const;

export const parseParams = (p: URLSearchParams): NurseryParams => ({
  q: p.get(KEYS.q) ?? '',
  district: p.get(KEYS.district),
  subCounty: p.get(KEYS.district) ? p.get(KEYS.subCounty) : null,
  species: p.get(KEYS.species),
  // Older links used ?category= (one seedling type); slugs only, so a hand-edited URL can't break the request
  categories: (p.get(KEYS.categories) ?? p.get('category') ?? '').split(',').filter(c => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(c)),
  certified: p.get(KEYS.certified) === 'true' ? true : p.get(KEYS.certified) === 'false' ? false : null,
  sort: p.get(KEYS.sort) === 'nearest' ? 'nearest' : 'name',
  view: p.get(KEYS.view) === 'list' ? 'list' : 'map',
  nursery: p.get(KEYS.nursery),
  directions: p.get(KEYS.directions) === '1',
});

export type ParamUpdate = Partial<NurseryParams>;

export const useNurseryParams = () => {
  const [search, setSearch] = useSearchParams();
  const params = useMemo(() => parseParams(search), [search]);

  /** Changes some filters; typing in the search box replaces history instead of adding to it. */
  const update = useCallback(
    (changes: ParamUpdate, { replace = false } = {}) => {
      setSearch(
        prev => {
          const next = new URLSearchParams(prev);
          const set = (key: string, value: string | null | undefined | boolean) => {
            if (value === null || value === undefined || value === '' || value === false) next.delete(key);
            else next.set(key, value === true ? '1' : value);
          };
          for (const [field, value] of Object.entries(changes) as [keyof NurseryParams, NurseryParams[keyof NurseryParams]][]) {
            // Defaults are left out of the URL to keep links short
            if (field === 'sort' && value === 'name') next.delete(KEYS.sort);
            else if (field === 'view' && value === 'map') next.delete(KEYS.view);
            else if (field === 'categories') {
              next.delete('category');
              set(KEYS.categories, Array.isArray(value) ? value.join(',') : null);
            } else if (field === 'certified') set(KEYS.certified, value === null ? null : String(value));
            else if (!Array.isArray(value)) set(KEYS[field], value);
          }
          // A new district invalidates the sub-county; closing the card ends directions
          if ('district' in changes && !('subCounty' in changes)) next.delete(KEYS.subCounty);
          if ('nursery' in changes && !('directions' in changes)) next.delete(KEYS.directions);
          return next;
        },
        { replace }
      );
    },
    [setSearch]
  );

  return { params, update };
};
