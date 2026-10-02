import type { ComboOption } from '../../components/Combobox';
import { en } from '../../copy/en';
import type { Place, Suggestion } from './api';

/** How a suggestion reads in the list: its name, a hint that tells similar names apart, and its kind. */
export const suggestionOption = (s: Suggestion): ComboOption => {
  switch (s.kind) {
    case 'species':
      return {
        key: `species:${s.slug}`,
        primary: s.label,
        secondary: [s.matched ? en.search.alsoCalled(s.matched) : s.scientific_name, en.search.atNurseries(s.nursery_count)].join(' · '),
        tag: en.search.kinds.species,
      };
    case 'nursery':
      return { key: `nursery:${s.id}`, primary: s.label, secondary: s.place, tag: en.search.kinds.nursery };
    case 'place':
      return {
        key: `place:${s.id}`,
        primary: s.label,
        secondary: s.parent_name ? `${en.search.levels[s.level]}, ${en.search.inDistrict(s.parent_name)}` : en.search.levels[s.level],
        tag: en.search.kinds.place,
      };
  }
};

export const placeOption = (p: Place, i: number): ComboOption => ({
  key: `${p.source}:${p.boundary_id ?? `${String(i)}:${String(p.lat)},${String(p.lng)}`}`,
  primary: p.name,
  secondary: p.context,
  tag: p.kind === 'district' || p.kind === 'sub_county' ? en.search.levels[p.kind] : en.search.kinds.place,
});
