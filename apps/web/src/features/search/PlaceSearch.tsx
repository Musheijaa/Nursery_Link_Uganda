import { isApiError } from '@nurserylink/api-client';
import { MapPin } from 'lucide-react';
import { useState } from 'react';
import { Combobox, type ComboOption } from '../../components/Combobox';
import { en } from '../../copy/en';
import { useDebounced } from '../../lib/useDebounced';
import { usePlaces, useSuggestions } from './api';
import { placeOption, suggestionOption } from './options';

export interface PickedPlace {
  lat: number;
  lng: number;
  name: string;
  /** e.g. "Goma Division, Mukono" */
  context: string;
}

/**
 * Find a place by typing its name. Districts and sub-counties are suggested as you type (from our
 * own data, spelling mistakes forgiven); pressing Search also looks up villages, schools and
 * landmarks in OpenStreetMap, whose free service may not be queried on every keystroke.
 */
export const PlaceSearch = ({ id, onPick, label = en.places.label, className, inline = false }: {
  id: string;
  onPick: (place: PickedPlace) => void;
  label?: string;
  className?: string;
  /** Results in the flow instead of floating (inside dialogs) */
  inline?: boolean;
}) => {
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const typed = useDebounced(text.trim(), 200);
  const own = useSuggestions(submitted === null ? typed : '', ['place']);
  const found = usePlaces(submitted);

  const ownPlaces = submitted === null && text.trim().length >= 2 ? (own.data?.data ?? []).filter(s => s.kind === 'place') : [];
  const foundPlaces = submitted !== null ? (found.data?.data ?? []) : [];

  let options: ComboOption[];
  let message: string | undefined;
  let note: string | undefined;
  if (submitted === null) {
    options = ownPlaces.map(suggestionOption);
    message = text.trim().length < 2 ? undefined : en.places.pressSearch;
    note = en.places.pressSearch;
  } else {
    options = foundPlaces.map(placeOption);
    if (found.isPending) message = en.places.searching;
    else if (found.isError) message = isApiError(found.error) && found.error.isOffline ? en.states.offlineNoCache : en.places.failed;
    else if (options.length === 0) message = found.data.meta.osm === 'unavailable' ? en.places.osmDown : en.places.none(submitted);
    note = found.data?.meta.osm === 'unavailable' ? en.places.osmDown : en.places.osmCredit;
  }

  const submit = () => {
    const q = text.trim();
    if (q.length >= 2) setSubmitted(q);
  };

  const choose = (i: number) => {
    if (submitted === null) {
      const s = ownPlaces[i];
      if (s?.kind === 'place') onPick({ lat: s.lat, lng: s.lng, name: s.label, context: s.parent_name ?? '' });
    } else {
      const p = foundPlaces[i];
      if (p) onPick({ lat: p.lat, lng: p.lng, name: p.name, context: p.context });
    }
  };

  return (
    <Combobox
      id={id}
      label={label}
      value={text}
      onChange={t => { setText(t); setSubmitted(null); }}
      placeholder={en.places.placeholder}
      options={options}
      onSelect={choose}
      onEnter={submit}
      message={message}
      note={note}
      className={className}
      inline={inline}
      inputClassName="pr-24"
      leading={<MapPin aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-bark-muted" />}
      trailing={({ open }) => (
        <button
          type="button"
          // Keep focus in the box so the results open under it
          onMouseDown={e => { e.preventDefault(); }}
          onClick={() => { submit(); open(); }}
          className="absolute inset-y-0 right-0 flex min-w-20 items-center justify-center rounded-r-sm bg-forest px-3 font-bold text-paper hover:bg-canopy"
        >
          {en.places.search}
        </button>
      )}
    />
  );
};
