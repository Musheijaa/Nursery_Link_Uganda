import React from 'react';
import { Download } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { usePlantingGaps, useSpecies } from '../../api/hooks';
import { errorMessage } from '../../api/client';
import { formatNumber } from '../../utils/format';
import { Button, Container, EmptyState, PageHeader, Photo } from '../ui';

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

export const PlantingGapsPage: React.FC = () => {
  const { setSpeciesFilter, setDistrictFilter, setBuyerDistrict, navigate, showToast } = useApp();
  const { data, isLoading, error } = usePlantingGaps();
  const { data: species = [] } = useSpecies();
  const speciesName = (id: string) => species.find(s => s.id === id)?.commonName ?? id;

  const districtRows = (data?.districts ?? []).map(d => ({ ...d, coverage: d.coveragePercent }));
  const areas = data?.areas ?? [];

  const findSeedlingsFor = (district: string, speciesId: string) => {
    setBuyerDistrict(district);
    setSpeciesFilter(speciesId);
    setDistrictFilter(null);
    navigate('seedlings');
  };

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ['District', 'Region', 'Tree cover loss (ha, 5 yrs)', 'Listed nurseries', 'Seedlings in stock', 'Estimated annual demand', 'Local supply covers (%)'],
      ...districtRows.map(r => [r.district, r.region, r.forestLossHa, r.nurseryCount, r.supply, r.annualDemand, r.coverage]),
    ];
    const blob = new Blob([rows.map(r => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `planting-gaps-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Planting gaps table downloaded');
  };

  return (
    <Container className="space-y-10 py-10">
      <PageHeader
        title="Planting gaps"
        intro="Districts where tree loss is high but few seedlings are available locally. This helps funders, district officers and nursery owners decide where new nurseries and planting are needed."
        actions={<Button variant="secondary" onClick={exportCsv}><Download className="h-4 w-4" /> Download CSV</Button>}
      />

      {isLoading && <p className="text-stone-600">Loading…</p>}
      {error && <EmptyState title="Could not load planting gaps">{errorMessage(error)}</EmptyState>}

      <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Forest-loss and demand figures on this page are illustrative for the demo. Nursery supply is calculated from the listings on this site.
      </p>

      <section>
        <h2 className="text-xl font-bold">Supply by district</h2>
        <p className="mt-1 text-sm text-stone-600">Sorted by how little of the estimated demand local nurseries can meet.</p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">District</th>
                <th className="px-4 py-3 text-right font-medium">Tree cover loss</th>
                <th className="px-4 py-3 text-right font-medium">Nurseries</th>
                <th className="px-4 py-3 text-right font-medium">Seedlings in stock</th>
                <th className="px-4 py-3 text-right font-medium">Yearly demand</th>
                <th className="w-48 px-4 py-3 font-medium">Local supply covers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {districtRows.map(r => (
                <tr key={r.district}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.district}</div>
                    <div className="text-xs text-stone-500">{r.region}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(r.forestLossHa)} ha</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.nurseryCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(r.supply)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(r.annualDemand)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                        <div
                          className={`h-full rounded-full ${r.coverage < 25 ? 'bg-soil-500' : 'bg-brand-600'}`}
                          style={{ width: `${Math.max(r.coverage, 2)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right tabular-nums">{r.coverage}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold">Forest-loss areas</h2>
        <p className="mt-1 text-sm text-stone-600">Places under pressure, the nearest listed nursery, and trees suited to restoring them.</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_2fr]">
          <div className="overflow-hidden rounded-lg border border-stone-200">
            <Photo imageKey="mabira-forest" className="h-full max-h-96 w-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {areas.map(area => (
              <article key={area.id} className="flex flex-col rounded-lg border border-stone-200 bg-white p-5">
                <h3 className="font-semibold">{area.name}</h3>
                <p className="text-sm text-stone-500">{area.district} District · about {formatNumber(area.forestLossHa)} ha lost</p>
                <p className="mt-3 text-sm text-stone-700">{area.drivers.join(', ')}.</p>
                {area.nearestNursery && (
                  <p className="mt-3 text-sm">
                    <span className="text-stone-500">Nearest nursery:</span>{' '}
                    {area.nearestNursery.name}, about {area.nearestNursery.distanceKm} km
                  </p>
                )}
                <p className="mt-1 text-sm">
                  <span className="text-stone-500">Suggested trees:</span>{' '}
                  {area.recommendedSpeciesIds.map(speciesName).join(', ')}
                </p>
                <div className="mt-auto pt-4">
                  <Button size="sm" variant="secondary" onClick={() => findSeedlingsFor(area.district, area.recommendedSpeciesIds[0])}>
                    Find seedlings for this area
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </Container>
  );
};
