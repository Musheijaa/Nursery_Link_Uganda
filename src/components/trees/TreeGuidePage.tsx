import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Region, SpeciesCategory } from '../../types';
import { useApp } from '../../context/AppContext';
import { useSpecies } from '../../api/hooks';
import { formatUGX } from '../../utils/format';
import { Badge, Button, Container, EmptyState, PageHeader, Photo, inputClass } from '../ui';

const CATEGORIES: SpeciesCategory[] = [
  'Indigenous timber',
  'Fast-growing timber',
  'Fruit tree',
  'Shade & agroforestry',
  'Medicinal & cultural',
];

const REGIONS: Region[] = ['Central', 'Eastern', 'Northern', 'Western'];

export const TreeGuidePage: React.FC = () => {
  const { setSpeciesFilter, setDistrictFilter, navigate } = useApp();
  const { data: allSpecies = [], isLoading } = useSpecies();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SpeciesCategory | null>(null);
  const [region, setRegion] = useState<Region | ''>('');

  const q = query.trim().toLowerCase();
  const species = allSpecies.filter(s =>
    (!q ||
      s.commonName.toLowerCase().includes(q) ||
      s.botanicalName.toLowerCase().includes(q) ||
      s.localNames.some(l => l.name.toLowerCase().includes(q))) &&
    (!category || s.category === category) &&
    (!region || s.regions.includes(region))
  );

  const findSeedlings = (speciesId: string) => {
    setSpeciesFilter(speciesId);
    setDistrictFilter(null);
    navigate('seedlings');
  };

  return (
    <Container className="space-y-6 py-10">
      <PageHeader
        title="Tree guide"
        intro="Native and introduced trees commonly planted in Uganda: where they grow, what they are used for, and how to plant them."
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:w-72">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-stone-400" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, e.g. Muvule"
            aria-label="Search trees"
            className={`${inputClass} pl-9`}
          />
        </div>
        <select value={region} onChange={e => setRegion(e.target.value as Region | '')} className={`${inputClass} md:w-48`} aria-label="Region">
          <option value="">All regions</option>
          {REGIONS.map(r => <option key={r} value={r}>{r} Uganda</option>)}
        </select>
        <div className="flex flex-wrap gap-2">
          {[null, ...CATEGORIES].map(c => (
            <button
              key={c ?? 'all'}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                category === c ? 'border-brand-700 bg-brand-700 text-white' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              {c ?? 'All'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-stone-600">Loading trees…</p>
      ) : species.length === 0 ? (
        <EmptyState title="No trees match your search" />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {species.map(s => {
            const nurseryCount = s.nurseryCount;
            const price = s.lowestPriceUGX;
            return (
              <article key={s.id} className="flex flex-col overflow-hidden rounded-lg border border-stone-200 bg-white">
                <Photo imageKey={s.image} className="aspect-[4/3] w-full" />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={s.isNative ? 'green' : 'neutral'}>{s.isNative ? 'Native' : 'Introduced'}</Badge>
                    <Badge>{s.category}</Badge>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold">{s.commonName}</h2>
                  <p className="text-sm text-stone-500">
                    <i>{s.botanicalName}</i>
                    {s.localNames.map(l => ` · ${l.language}: ${l.name}`).join('')}
                  </p>
                  <p className="mt-3 text-sm text-stone-700">{s.description}</p>

                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-stone-500">Growth</dt>
                      <dd className="font-medium">{s.growthRate}</dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">Harvest</dt>
                      <dd className="font-medium">{s.timeToHarvest}</dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">Altitude</dt>
                      <dd className="font-medium">{s.altitudeM[0]}–{s.altitudeM[1]} m</dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">Regions</dt>
                      <dd className="font-medium">{s.regions.length === 4 ? 'All of Uganda' : s.regions.join(', ')}</dd>
                    </div>
                  </dl>

                  <div className="mt-4 text-sm">
                    <p className="text-stone-500">Uses</p>
                    <ul className="mt-1 list-inside list-disc text-stone-700">
                      {s.uses.map(u => <li key={u}>{u}</li>)}
                    </ul>
                  </div>

                  <p className="mt-4 rounded-md bg-stone-50 p-3 text-sm text-stone-700">
                    <span className="font-medium">Planting tip:</span> {s.plantingTip}
                  </p>

                  <div className="mt-auto pt-5">
                    <Button variant={nurseryCount ? 'primary' : 'secondary'} disabled={!nurseryCount} onClick={() => findSeedlings(s.id)} className="w-full">
                      {nurseryCount
                        ? `${nurseryCount} ${nurseryCount === 1 ? 'nursery' : 'nurseries'} · from ${formatUGX(price!)}`
                        : 'Not in stock right now'}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Container>
  );
};
