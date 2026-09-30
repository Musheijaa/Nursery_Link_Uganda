import React, { useState } from 'react';
import { List, Map as MapIcon } from 'lucide-react';
import { Nursery } from '../../types';
import { useApp } from '../../context/AppContext';
import { useDistricts, useNurseries, usePlantingGaps, useSpecies } from '../../api/hooks';
import { errorMessage } from '../../api/client';
import { formatNumber, formatUGX } from '../../utils/format';
import { Badge, Button, EmptyState, inputClass } from '../ui';
import { NurseryMap } from './NurseryMap';
import { NurseryDetail } from './NurseryDetail';

export const FindSeedlingsPage: React.FC = () => {
  const {
    speciesFilter,
    setSpeciesFilter,
    districtFilter,
    setDistrictFilter,
    buyerDistrict,
    setBuyerDistrict,
  } = useApp();

  const { data: species = [] } = useSpecies();
  const { data: districts = [] } = useDistricts();
  const [showForestLoss, setShowForestLoss] = useState(false);
  const { data: gaps } = usePlantingGaps();
  const { data: results = [], isLoading, error } = useNurseries({ species: speciesFilter, district: districtFilter, near: buyerDistrict });

  const [selected, setSelected] = useState<Nursery | null>(null);
  const [openNurseryId, setOpenNurseryId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');

  const speciesName = (id: string) => species.find(s => s.id === id)?.commonName ?? id;
  const buyerLocation = districts.find(d => d.name === buyerDistrict);
  const selectedSpecies = speciesFilter ? species.find(s => s.id === speciesFilter) : null;
  const hasFilters = speciesFilter !== null || districtFilter !== null;

  const openDetail = (nursery: Nursery) => {
    setSelected(nursery);
    setOpenNurseryId(nursery.id);
  };

  return (
    <div className="lg:grid lg:h-[calc(100vh-6rem)] lg:grid-cols-[420px_1fr]">
      {/* Filters and results */}
      <div className={`flex-col border-r border-stone-200 bg-white lg:flex lg:overflow-y-auto ${mobileView === 'list' ? 'flex' : 'hidden'}`}>
        <div className="space-y-4 border-b border-stone-200 p-5">
          <div>
            <h1 className="text-2xl font-bold">Find seedlings</h1>
            <p className="text-sm text-stone-600">Nurseries nearest to your planting area are listed first.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Tree</span>
              <select value={speciesFilter ?? ''} onChange={e => setSpeciesFilter(e.target.value || null)} className={inputClass}>
                <option value="">Any tree</option>
                {species.map(s => <option key={s.id} value={s.id}>{s.commonName}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">I will plant in</span>
              <select value={buyerDistrict} onChange={e => setBuyerDistrict(e.target.value)} className={inputClass}>
                {districts.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Nursery district</span>
              <select value={districtFilter ?? ''} onChange={e => setDistrictFilter(e.target.value || null)} className={inputClass}>
                <option value="">All districts</option>
                {districts.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 self-end text-sm text-stone-700">
              <input type="checkbox" checked={showForestLoss} onChange={e => setShowForestLoss(e.target.checked)} className="h-4 w-4 accent-soil-600" />
              Show forest-loss areas on map
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 text-sm text-stone-600">
          <span aria-live="polite">
            {isLoading ? 'Searching…' : `${results.length} ${results.length === 1 ? 'nursery' : 'nurseries'}${selectedSpecies ? ` with ${selectedSpecies.commonName}` : ''}`}
          </span>
          {hasFilters && (
            <button onClick={() => { setSpeciesFilter(null); setDistrictFilter(null); }} className="font-medium text-brand-700 hover:underline">
              Clear filters
            </button>
          )}
        </div>

        <ul className="flex-1 space-y-3 px-5 pb-20 lg:pb-5">
          {error && (
            <li><EmptyState title="Could not load nurseries">{errorMessage(error)}</EmptyState></li>
          )}
          {!isLoading && !error && results.length === 0 && (
            <li>
              <EmptyState title="No nurseries match">Try another tree or choose “All districts”.</EmptyState>
            </li>
          )}

          {results.map(nursery => {
            const match = speciesFilter
              ? nursery.batches.find(b => b.speciesId === speciesFilter && b.quantityAvailable > 0)
              : null;
            const speciesNames = Array.from(new Set(nursery.batches.map(b => speciesName(b.speciesId))));
            const inStock = nursery.batches.filter(b => b.quantityAvailable > 0);
            const fromPrice = inStock.length ? Math.min(...inStock.map(b => b.unitPriceUGX)) : null;
            const totalStock = nursery.batches.reduce((sum, b) => sum + b.quantityAvailable, 0);

            return (
              <li
                key={nursery.id}
                onMouseEnter={() => setSelected(nursery)}
                className={`rounded-lg border p-4 transition-colors ${selected?.id === nursery.id ? 'border-brand-600 bg-brand-50/40' : 'border-stone-200 bg-white'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{nursery.name}</h2>
                    <p className="text-sm text-stone-500">
                      {nursery.subCounty}, {nursery.district}{nursery.distanceKm !== null && ` · about ${nursery.distanceKm} km`}
                    </p>
                  </div>
                  <Badge tone="green" className="shrink-0">{nursery.registration}</Badge>
                </div>

                {match ? (
                  <p className="mt-3 text-sm">
                    <strong>{selectedSpecies?.commonName}</strong>: {formatUGX(match.unitPriceUGX)} each · {formatNumber(match.quantityAvailable)} in stock
                    {match.status === 'Ready soon' && <Badge tone="amber" className="ml-2">Ready soon</Badge>}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-stone-700">
                    {speciesNames.join(', ')}{fromPrice !== null && ` · from ${formatUGX(fromPrice)}`}
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-stone-500">
                    {formatNumber(totalStock)} seedlings · {nursery.deliveryMethods.filter(m => m !== 'Collect from nursery').join(', ') || 'Collection only'}
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => openDetail(nursery)} className="shrink-0 whitespace-nowrap">View seedlings</Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Map */}
      <div className={`relative isolate h-[calc(100vh-9rem)] lg:block lg:h-full ${mobileView === 'map' ? 'block' : 'hidden'}`}>
        {buyerLocation && (
          <NurseryMap
            nurseries={results}
            selected={selected}
            buyerLocation={{ name: buyerLocation.name, coordinates: buyerLocation.coordinates }}
            forestAreas={showForestLoss ? gaps?.areas ?? [] : []}
            onSelect={setSelected}
            onOpen={openDetail}
          />
        )}
      </div>

      {/* Mobile list/map switch */}
      <div className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 lg:hidden">
        <Button onClick={() => setMobileView(v => (v === 'list' ? 'map' : 'list'))} className="rounded-full shadow-lg">
          {mobileView === 'list' ? <><MapIcon className="h-4 w-4" /> Show map</> : <><List className="h-4 w-4" /> Show list</>}
        </Button>
      </div>

      {openNurseryId && (
        <NurseryDetail nurseryId={openNurseryId} buyerDistrict={buyerDistrict} onClose={() => setOpenNurseryId(null)} />
      )}
    </div>
  );
};
