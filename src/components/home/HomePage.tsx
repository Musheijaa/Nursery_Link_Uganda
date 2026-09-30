import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useDistricts, useProgrammes, useSpecies, useStats } from '../../api/hooks';
import { MONTH_LABELS, PLANTING_SEASONS } from '../../data/plantingSeasons';
import { formatCompact, formatDate, formatUGX } from '../../utils/format';
import { Badge, Button, Container, Photo, inputClass } from '../ui';

const FEATURED_SPECIES = ['musizi', 'mvule', 'avocado', 'grevillea', 'mango', 'shea'];

const STEPS = [
  {
    title: 'Choose a nursery',
    text: 'Compare stock, prices and distance across registered nurseries. Every listing shows its NFA, MAAIF or district registration.',
  },
  {
    title: 'Pay with Mobile Money',
    text: 'Approve the payment on your phone with MTN MoMo or Airtel Money. We hold the money until your seedlings arrive.',
  },
  {
    title: 'Check, then confirm',
    text: 'Count and inspect the seedlings when they arrive. Give the rider your delivery code and the nursery gets paid.',
  },
];

export const HomePage: React.FC = () => {
  const { navigate, setSpeciesFilter, setDistrictFilter, setBuyerDistrict, buyerDistrict } = useApp();
  const { data: stats } = useStats();
  const { data: species = [] } = useSpecies();
  const { data: districts = [] } = useDistricts();
  const { data: programmes = [] } = useProgrammes();
  const [searchSpecies, setSearchSpecies] = useState('');
  const [searchDistrict, setSearchDistrict] = useState(buyerDistrict);

  const openProgrammes = programmes.filter(p => p.status === 'Open');
  const featured = FEATURED_SPECIES.flatMap(id => species.filter(s => s.id === id));
  const currentMonth = new Date().getMonth();

  const findSeedlings = (speciesId: string | null) => {
    setSpeciesFilter(speciesId);
    setDistrictFilter(null);
    navigate('seedlings');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setBuyerDistrict(searchDistrict);
    findSeedlings(searchSpecies || null);
  };

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-stone-900">
        <Photo imageKey="hero-nursery-beds" eager className="absolute inset-0 -z-10 h-full w-full" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-stone-950/85 via-stone-950/55 to-transparent" />
        <Container className="py-16 sm:py-24">
          <div className="max-w-2xl text-white">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
              Tree seedlings from registered nurseries, delivered across Uganda
            </h1>
            <p className="mt-4 text-lg text-stone-200">
              Compare prices and stock, pay with MTN MoMo or Airtel Money, and have seedlings delivered by boda boda or truck, or collect them yourself.
            </p>
          </div>

          <form onSubmit={handleSearch} className="mt-8 grid max-w-3xl gap-3 rounded-lg bg-white p-4 shadow-lg sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-800">What do you want to plant?</span>
              <select value={searchSpecies} onChange={e => setSearchSpecies(e.target.value)} className={inputClass}>
                <option value="">Any tree</option>
                {species.map(s => (
                  <option key={s.id} value={s.id}>{s.commonName}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-800">Where will you plant?</span>
              <select value={searchDistrict} onChange={e => setSearchDistrict(e.target.value)} className={inputClass}>
                {districts.map(d => (
                  <option key={d.name} value={d.name}>{d.name}</option>
                ))}
              </select>
            </label>
            <Button type="submit" size="md">Find seedlings</Button>
          </form>
        </Container>
      </section>

      {/* Live numbers */}
      <section className="border-b border-stone-200 bg-white">
        <Container className="grid grid-cols-2 divide-stone-200 py-6 sm:grid-cols-4 sm:divide-x">
          {[
            { value: stats ? stats.nurseries.toString() : '–', label: 'registered nurseries' },
            { value: stats ? stats.districts.toString() : '–', label: 'districts' },
            { value: stats ? stats.species.toString() : '–', label: 'tree species' },
            { value: stats ? formatCompact(stats.seedlingsInStock) : '–', label: 'seedlings ready now' },
          ].map(stat => (
            <div key={stat.label} className="px-4 py-2 sm:px-6">
              <div className="text-2xl font-bold text-brand-800">{stat.value}</div>
              <div className="text-sm text-stone-600">{stat.label}</div>
            </div>
          ))}
        </Container>
      </section>

      <Container className="space-y-20 py-16">
        {/* How it works */}
        <section>
          <h2 className="text-2xl font-bold">How ordering works</h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-lg border border-stone-200 bg-white p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-800">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-stone-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Planting calendar */}
        <section className="grid gap-8 lg:grid-cols-[1fr_2fr] lg:items-start">
          <div>
            <h2 className="text-2xl font-bold">When to plant</h2>
            <p className="mt-2 text-stone-600">
              Plant at the start of the rains so roots establish before the dry season. Order seedlings two to four weeks ahead so they are ready when the ground is wet.
            </p>
            <p className="mt-3 text-sm text-stone-500">General guide only. Check with your local extension officer for your area.</p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500">
                  <th className="px-4 py-3 text-left font-medium">Area</th>
                  {MONTH_LABELS.map((m, i) => (
                    <th key={i} className={`w-8 py-3 text-center font-medium ${i === currentMonth ? 'text-brand-800' : ''}`}>
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PLANTING_SEASONS.map(season => (
                  <tr key={season.area} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{season.area}</div>
                      <div className="text-xs text-stone-500">{season.note}</div>
                    </td>
                    {MONTH_LABELS.map((_, i) => (
                      <td key={i} className="px-0.5 py-3">
                        <div
                          className={`mx-auto h-5 w-6 rounded-sm ${
                            season.plantingMonths.includes(i) ? 'bg-brand-600' : 'bg-stone-100'
                          } ${i === currentMonth ? 'ring-2 ring-soil-400 ring-offset-1' : ''}`}
                          title={season.plantingMonths.includes(i) ? 'Good planting month' : undefined}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-4 border-t border-stone-100 px-4 py-2 text-xs text-stone-500">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-brand-600" /> Good planting month</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm ring-2 ring-soil-400" /> This month</span>
            </div>
          </div>
        </section>

        {/* Popular trees */}
        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Popular trees</h2>
              <p className="mt-1 text-stone-600">Timber, fruit and shade trees farmers ask for most.</p>
            </div>
            <Button variant="ghost" onClick={() => navigate('trees')} className="hidden sm:inline-flex">
              Full tree guide <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map(tree => {
              const price = tree.lowestPriceUGX;
              const nurseryCount = tree.nurseryCount;
              const localName = tree.localNames[0];
              return (
                <button
                  key={tree.id}
                  onClick={() => findSeedlings(tree.id)}
                  className="group overflow-hidden rounded-lg border border-stone-200 bg-white text-left transition-shadow hover:shadow-md"
                >
                  <Photo imageKey={tree.image} className="aspect-[4/3] w-full" />
                  <div className="p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-semibold group-hover:text-brand-700">{tree.commonName}</h3>
                      {localName && localName.name !== tree.commonName && (
                        <span className="text-sm text-stone-500">{localName.name}</span>
                      )}
                    </div>
                    <p className="text-sm italic text-stone-500">{tree.botanicalName}</p>
                    <p className="mt-3 text-sm text-stone-700">
                      {price !== null
                        ? <>From <strong>{formatUGX(price)}</strong> at {nurseryCount} {nurseryCount === 1 ? 'nursery' : 'nurseries'}</>
                        : 'Currently out of stock'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Programmes and nursery owners */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-stone-200 bg-white p-6">
            <h2 className="text-xl font-bold">Free seedling programmes</h2>
            <p className="mt-1 text-sm text-stone-600">
              NGOs, companies and community organisations give free seedlings to eligible farmers, groups and schools.
            </p>
            <ul className="mt-5 divide-y divide-stone-100">
              {openProgrammes.map(p => (
                <li key={p.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium">{p.title}</p>
                    <p className="text-sm text-stone-500">
                      {p.districts.length ? p.districts.join(', ') : 'All districts'} · closes {formatDate(p.deadline)}
                    </p>
                  </div>
                  <Badge tone="green" className="shrink-0">Open</Badge>
                </li>
              ))}
            </ul>
            <Button variant="secondary" className="mt-4" onClick={() => navigate('programmes')}>
              See programmes and apply
            </Button>
          </div>

          <div className="grid overflow-hidden rounded-lg border border-stone-200 bg-white sm:grid-cols-[2fr_3fr]">
            <Photo imageKey="nurseryman-kapchorwa" className="h-56 w-full sm:h-full" />
            <div className="p-6">
              <h2 className="text-xl font-bold">Run a tree nursery?</h2>
              <p className="mt-2 text-sm text-stone-600">
                List your seedlings, receive orders from buyers across the country, and get paid to your Mobile Money number once the buyer confirms delivery.
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-stone-700">
                <li>• Keep stock and prices up to date from your phone</li>
                <li>• Payment is secured before you dispatch</li>
                <li>• Collection point for free seedling programmes</li>
              </ul>
              <Button className="mt-5" onClick={() => navigate('nursery')}>Nursery owner tools</Button>
            </div>
          </div>
        </section>
      </Container>
    </>
  );
};
