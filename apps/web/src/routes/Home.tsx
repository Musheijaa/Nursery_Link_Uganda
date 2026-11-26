import { Button } from '@nurserylink/ui';
import { ArrowRight, BookOpen, MapPinned, Phone, Truck, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Picture } from '../components/Picture';
import { usePageTitle } from '../components/usePageTitle';
import { en } from '../copy/en';
import { IMAGES } from '../data/images';
import { paragraphs, usePageCopy, usePartners } from '../features/content/api';
import { PAGE_FRAME } from '../lib/layout';

/** The modules strip: each part of the site with a real photo from Uganda (decorative: the title names the link). */
const MODULES = [
  { to: '/nurseries', label: en.nav.nurseries, hint: en.home.modules.nurseriesHint, photo: 'nurseryman-kapchorwa', w: 800, h: 1200, focus: 'object-[50%_18%]' },
  { to: '/library', label: en.nav.library, hint: en.home.modules.libraryHint, photo: 'mabira-forest', w: 960, h: 720, focus: 'object-center' },
  { to: '/expert-services', label: en.nav.expertServices, hint: en.home.modules.servicesHint, photo: 'agroforestry-masaka', w: 960, h: 640, focus: 'object-center' },
  { to: '/giveaways', label: en.nav.giveaways, hint: en.home.modules.giveawaysHint, photo: 'community-planting', w: 960, h: 641, focus: 'object-[60%_40%]' },
] as const;

/** An icon for each of the four steps of How It Works */
const STEP_ICONS: LucideIcon[] = [MapPinned, BookOpen, Phone, Truck];

/** Five logo places in the partners grid; empty ones show a neutral placeholder (no invented logos) */
const PARTNER_SLOTS = 5;

const Container = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`${PAGE_FRAME} ${className}`}>{children}</div>
);

const SectionTitle = ({ id, children }: { id: string; children: ReactNode }) => (
  <h2 id={id} className="text-h2">
    {children}
    <span aria-hidden className="mt-3 block h-1 w-12 rounded-full bg-murram" />
  </h2>
);

const Steps = () => {
  const copy = usePageCopy('home.how_it_works');
  const steps = (copy.data.steps ?? en.content['home.how_it_works'].data.steps) as { title: string; body: string }[];
  return (
    <section aria-labelledby="home-steps" className="bg-sky-tint py-14 md:py-20">
      <Container className="flex flex-col gap-8">
        <SectionTitle id="home-steps">{copy.title}</SectionTitle>
        {/* Desktop: the four steps in a row; phones: stacked */}
        <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => {
            const Icon = STEP_ICONS[i] ?? MapPinned;
            return (
              <li key={step.title} className="flex flex-col gap-3 rounded-lg bg-paper p-5 shadow-card">
                <span className="flex items-center gap-3">
                  <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-seedling-tint text-canopy">
                    <Icon className="size-6" />
                  </span>
                  <span className="font-label text-sm font-bold text-murram">{en.home.step(i + 1)}</span>
                </span>
                <h3 className="text-lg">{step.title}</h3>
                <p className="text-bark-muted">{step.body}</p>
              </li>
            );
          })}
        </ol>
        <Button asChild className="self-start" size="lg">
          <Link to="/nurseries">
            {en.nav.nurseries}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </Container>
    </section>
  );
};

const Partners = () => {
  const copy = usePageCopy('home.partners');
  const partners = usePartners();
  const list = partners.data ?? [];
  const placeholders = Math.max(0, PARTNER_SLOTS - list.length);
  return (
    <section aria-labelledby="home-partners" className="bg-paper py-14 md:py-20">
      <Container className="flex flex-col gap-8">
        <div className="flex max-w-2xl flex-col gap-3">
          <SectionTitle id="home-partners">{copy.title}</SectionTitle>
          {copy.body && <p className="text-lg text-bark-muted">{copy.body}</p>}
        </div>
        {/* 5 across on desktop, 2–3 a row on phones; more than five simply wrap */}
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {list.map(p => {
            const logo = p.logo_url ? (
              <img src={p.logo_url} alt={p.name} loading="lazy" decoding="async" className="max-h-20 w-auto max-w-full object-contain" />
            ) : (
              <span className="text-center font-bold text-bark">{p.name}</span>
            );
            return (
              <li key={p.id} className="flex aspect-[3/2] items-center justify-center rounded-lg bg-mist p-4 ring-1 ring-line">
                {p.website_url ? (
                  <a href={p.website_url} target="_blank" rel="noopener noreferrer" className="flex size-full items-center justify-center">
                    {logo}
                    <span className="sr-only">{en.home.opensNewTab}</span>
                  </a>
                ) : logo}
              </li>
            );
          })}
          {Array.from({ length: placeholders }, (_, i) => (
            <li key={`slot-${String(i)}`} className="flex aspect-[3/2] items-center justify-center rounded-lg border-2 border-dashed border-line p-4 text-sm font-bold text-bark-muted">
              {en.home.partnerLogo}
            </li>
          ))}
        </ul>
        <Link to="/donate" className="self-start font-bold">{en.home.partnerCta}</Link>
      </Container>
    </section>
  );
};

/** Home: the welcome, how getting seedlings works, the parts of the site, and partners. */
const Home = () => {
  usePageTitle();
  const hero = usePageCopy('home.hero');
  const photo = IMAGES['greenhouse-kamuli'];

  return (
    <div className="flex flex-col">
      {/* Hero: a big shade-net tree nursery in Kamuli, under a canopy-green wash where the text sits */}
      <section aria-labelledby="home-title" className="on-dark relative isolate overflow-hidden bg-canopy">
        {/* Phones: the photo across the top, fading into green. Wider: the photo fills the right side. */}
        <div className="absolute inset-x-0 top-0 -z-10 h-64 sm:h-72 md:inset-y-0 md:right-0 md:left-auto md:h-auto md:w-[58%]">
          {photo && (
            <Picture src={photo.src} alt="" width={1400} height={867} priority wide sizes="(min-width: 768px) 58vw, 50vw" className="size-full object-cover object-[50%_45%]" />
          )}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-canopy via-canopy/30 to-canopy/10 md:bg-gradient-to-r md:from-canopy md:via-canopy/25 md:to-transparent" />
        </div>
        <Container className="flex flex-col justify-end pt-48 pb-14 sm:pt-56 md:min-h-[calc(100dvh-4rem)] md:justify-center md:py-16">
          <div className="flex flex-col gap-4 md:w-[56%] lg:w-[52%]">
            <p className="flex flex-col gap-1">
              <span className="font-label text-sm font-bold tracking-wide text-murram-light">{String(hero.data.eyebrow ?? en.content['home.hero'].data.eyebrow)}</span>
              {hero.subtitle && <span className="font-display text-lg text-mist">{hero.subtitle}</span>}
            </p>
            <h1 id="home-title" className="max-w-2xl text-display text-paper">{hero.title}</h1>
            <div className="flex max-w-xl flex-col gap-3 text-base text-mist/90 md:text-lg">
              {paragraphs(hero.body).map((lines, i, all) => (
                <p key={lines.join()} className={i === all.length - 1 ? 'font-bold text-paper' : undefined}>
                  {lines.map((line, j) => (j === 0 ? line : <span key={line}><br />{line}</span>))}
                </p>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild variant="accent" size="lg">
                <Link to="/nurseries">
                  {en.nav.nurseries}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="onDark" size="lg">
                <Link to="/library">{en.home.exploreLibrary}</Link>
              </Button>
            </div>
          </div>
        </Container>
      </section>

      <Steps />

      {/* The parts of the site as photo cards */}
      <section aria-labelledby="home-modules" className="bg-mist py-14 md:py-20">
        <Container className="flex flex-col gap-8">
          <div className="flex max-w-2xl flex-col gap-3">
            <SectionTitle id="home-modules">{en.home.modulesHeading}</SectionTitle>
          </div>
          <nav aria-label={en.home.modulesHeading}>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-4">
              {MODULES.map(m => {
                const img = IMAGES[m.photo];
                return (
                  <li key={m.to}>
                    <Link
                      to={m.to}
                      className="group relative flex aspect-[16/10] flex-col justify-end overflow-hidden rounded-lg bg-canopy no-underline shadow-card transition-shadow hover:shadow-lift sm:aspect-[4/3]"
                    >
                      {img && (
                        <Picture
                          src={img.src}
                          alt=""
                          width={m.w}
                          height={m.h}
                          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                          className={`absolute inset-0 size-full object-cover ${m.focus} transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100`}
                        />
                      )}
                      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-canopy via-canopy/55 to-transparent" />
                      <span className="relative flex flex-col gap-1 p-4 md:p-5">
                        <span className="flex items-center justify-between gap-2 font-display text-2xl leading-tight font-semibold text-paper">
                          {m.label}
                          <ArrowRight aria-hidden className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                        </span>
                        <span className="text-mist/90">{m.hint}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </Container>
      </section>

      <Partners />
    </div>
  );
};
export default Home;
