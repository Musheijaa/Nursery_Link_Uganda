import React from 'react';
import { ArrowRight, BadgeCheck, BarChart3, Leaf, MapPinned, ShieldCheck, Sprout, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';

const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

const features = [
  {
    icon: MapPinned,
    title: 'Smart nursery matching',
    text: 'Search by district, species, certification and delivery radius to locate the best source for your planting needs.',
  },
  {
    icon: Sprout,
    title: 'Climate smart seedlings',
    text: 'Access agroforestry, fruit tree and native species bundles selected for Uganda’s growing conditions and soil resilience.',
  },
  {
    icon: BarChart3,
    title: 'Impact analytics',
    text: 'Track deforestation pressure, tree survival and nursery performance through a clean district-level dashboard.',
  },
];

const showcase = [
  {
    title: 'Healthy nursery stock',
    text: 'Strong, verified seedlings ready for farms, schools and community landscapes.',
    image:
      'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: 'Field-ready planting',
    text: 'From nursery beds to community plots, planting support is coordinated for real impact.',
    image:
      'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: 'Greener futures',
    text: 'We support resilient landscapes and long-term food and climate security across Uganda.',
    image:
      'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?auto=format&fit=crop&w=900&q=80',
  },
];

export const LandingPage: React.FC = () => {
  const { setActiveTab, nurseries, species, campaigns } = useApp();

  // Headline stats are derived from live platform data rather than hard-coded
  const stats = [
    { label: 'Seedlings in stock', value: compactNumber.format(nurseries.reduce((sum, n) => sum + n.currentStockTotal, 0)) },
    { label: 'Verified nurseries', value: nurseries.length.toString() },
    { label: 'Tree species listed', value: species.length.toString() },
    {
      label: 'Open seedling campaigns',
      value: campaigns.filter(c => c.status === 'Active & Accepting Applications').length.toString()
    },
  ];

  return (
    <div className="bg-[#f4f8f1] text-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <section className="relative overflow-hidden rounded-[32px] border border-emerald-100 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div
            className="relative min-h-[560px] bg-cover bg-center"
            style={{
              backgroundImage:
                "linear-gradient(90deg, rgba(8, 44, 21, 0.72) 0%, rgba(8, 44, 21, 0.48) 35%, rgba(8, 44, 21, 0.2) 100%), url('https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1600&q=80')",
            }}
          >
            <div className="relative z-10 flex min-h-[560px] items-center px-6 sm:px-10 lg:px-16">
              <div className="max-w-xl text-white">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100 backdrop-blur-sm">
                  <Leaf className="h-3.5 w-3.5" />
                  Nursery Link Uganda
                </div>

                <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                  Growing a Greener Future with Seedling Access.
                </h1>

                <p className="mt-5 max-w-lg text-base text-emerald-50/90 sm:text-lg">
                  Connect farmers, schools and communities to verified nurseries, climate-smart tree species and reliable delivery support across Uganda.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <button
                    onClick={() => setActiveTab('map')}
                    className="inline-flex items-center gap-2 rounded-full bg-[#1aa669] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-[#0f8d55]"
                  >
                    Explore nursery map
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setActiveTab('campaigns')}
                    className="rounded-full border border-white/40 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
                  >
                    See free seedlings
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((item) => (
            <div key={item.label} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <div className="text-3xl font-black tracking-tight text-[#006f3f]">{item.value}</div>
              <div className="mt-2 text-sm text-slate-600">{item.label}</div>
            </div>
          ))}
        </section>

        <section className="mt-16">
          <div className="mb-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Why choose us</p>
            <h2 className="mt-3 text-3xl font-black text-slate-900 sm:text-4xl">We make planting easier, smarter and more sustainable.</h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-[28px] border border-emerald-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-6 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Our landscape</p>
              <h2 className="mt-2 text-3xl font-black text-slate-900">From seedling beds to healthy farms</h2>
            </div>
            <button
              onClick={() => setActiveTab('map')}
              className="hidden rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-[#007A33] sm:inline-flex"
            >
              View map
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {showcase.map((item) => (
              <div key={item.title} className="overflow-hidden rounded-[26px] border border-slate-200 bg-slate-100 shadow-sm">
                <div
                  className="h-64 bg-cover bg-center"
                  style={{ backgroundImage: `url('${item.image}')` }}
                />
                <div className="bg-white p-5">
                  <h3 className="text-xl font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-[30px] bg-[#0d2d1d] p-6 text-white shadow-xl sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Our mission</p>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">Healthy forests start with trusted seedlings and local access.</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/5 p-4">
                <ShieldCheck className="h-8 w-8 text-emerald-300" />
                <p className="mt-3 text-sm text-emerald-50/80">Every listed nursery carries a verifiable accreditation number.</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <Users className="h-8 w-8 text-emerald-300" />
                <p className="mt-3 text-sm text-emerald-50/80">Built for farmers, schools, cooperatives and restoration planners.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 pb-10">
          <div className="mb-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Roadmap</p>
            <h2 className="mt-3 text-3xl font-black text-slate-900 sm:text-4xl">Where we're headed</h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {[
              'Expand climate-resilient nursery networks in high-deforestation districts.',
              'Increase access to indigenous and fruit tree species for household agroforestry.',
              'Support smallholders with transparent ordering, escrow and local delivery coordination.',
            ].map((item) => (
              <div key={item} className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1aa669] text-white">
                  <BadgeCheck className="h-5 w-5" />
                </div>
                <p className="text-base leading-7 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
};
