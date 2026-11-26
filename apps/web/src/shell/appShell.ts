import { en } from '../copy/en.ts';
import { IMAGES } from '../data/images.ts';
// The file itself, not the package entry: this runs in Node at build time, without React
import { BRAND_MARK_BODY, BRAND_MARK_VIEWBOX } from '../../../../packages/ui/src/icons/brandMarkSvg.ts';
import { PAGE_FRAME } from '../lib/layout.ts';

/**
 * The app shell: plain HTML for what a visitor sees first, painted from index.html before the app's
 * JavaScript has loaded (on a slow phone connection that takes a couple of seconds). React then
 * replaces it with the same markup, so nothing moves.
 *
 * Built at build time by the vite.config.ts plugin, from the same copy and photo data as the app.
 * The class names mirror components/Layout.tsx (Header), components/Logo.tsx and routes/Home.tsx
 * (the hero): change them together. The "shell" E2E check compares the two.
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const NAV = [
  { to: '/', label: en.app.home },
  { to: '/nurseries', label: en.nav.nurseries },
  { to: '/library', label: en.nav.library },
  { to: '/expert-services', label: en.nav.expertServices },
  { to: '/news', label: en.nav.news },
  { to: '/giveaways', label: en.nav.giveaways },
  { to: '/donate', label: en.nav.donate },
];

const navLink = 'flex min-h-11 min-w-11 items-center gap-2 whitespace-nowrap rounded-sm px-3 font-label text-label no-underline text-paper/90 xl:justify-center xl:px-2.5';
// components/Layout.tsx donateLink
const donateLink = 'ml-1.5 flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full bg-sprout px-4 font-label text-label font-bold text-sprout-ink no-underline';

// lucide's House icon, as components/Layout.tsx shows it next to "Home"
const HOUSE = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="size-5"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';

// lucide's Search icon, as the header shows it
const SEARCH = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="size-6"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>';

const MARK = `<svg width="34" height="34" viewBox="${BRAND_MARK_VIEWBOX}" aria-hidden="true" class="shrink-0 rounded-[9px] ring-1 ring-paper/15">${BRAND_MARK_BODY}</svg>`;

/** The header bar (every page). Links work before the app loads; the account area is left empty. */
const header = () =>
  `<header class="on-dark sticky top-0 z-30 bg-canopy"><div class="${PAGE_FRAME} flex h-16 items-center justify-between gap-4">` +
  `<a href="/" class="flex min-h-11 shrink-0 items-center gap-2.5 whitespace-nowrap text-paper no-underline" aria-label="${esc(`${en.app.fullName}, ${en.app.home}`)}">${MARK}` +
  `<span class="flex flex-col leading-none"><span class="font-display text-xl font-semibold tracking-tight">${esc(en.app.name)}</span>` +
  `<span class="text-xs font-bold text-murram-light">${esc(en.footer.country)}</span></span></a>` +
  '<nav aria-label="Main" class="hidden items-center gap-0.5 xl:flex">' +
  NAV.map(n =>
    n.to === '/donate'
      ? `<a href="${n.to}" class="${donateLink}">${esc(n.label)}</a>`
      : `<a href="${n.to}" class="${navLink}">${n.to === '/' ? `${HOUSE}<span class="sr-only min-[1500px]:not-sr-only">${esc(n.label)}</span>` : esc(n.label)}</a>`
  ).join('') +
  '</nav><div class="flex items-center gap-1">' +
  `<a href="/search" aria-label="${esc(en.siteSearch.open)}" class="flex size-11 items-center justify-center rounded-sm text-paper hover:bg-paper/10">${SEARCH}</a>` +
  `<a href="/" aria-label="${esc(en.app.home)}" class="flex size-11 items-center justify-center rounded-sm text-paper hover:bg-paper/10 xl:hidden">${HOUSE.replace('class="size-5"', 'class="size-6"')}</a>` +
  '<span class="size-11 xl:hidden"></span></div></div></header>';

/** Home's hero: the photo, the welcome and the two buttons (the client's copy from copy/en.ts). */
const homeHero = () => {
  const hero = IMAGES['greenhouse-kamuli'];
  const base = '/images/greenhouse-kamuli';
  const copy = en.content['home.hero'];
  const paras = copy.body.split(/\n{2,}/);
  return (
    '<section class="on-dark relative isolate overflow-hidden bg-canopy">' +
    '<div class="absolute inset-x-0 top-0 -z-10 h-64 sm:h-72 md:inset-y-0 md:right-0 md:left-auto md:h-auto md:w-[58%]">' +
    `<picture class="contents"><source type="image/webp" srcset="${base}-480.webp 480w, ${base}-960.webp 960w, ${base}-1400.webp 1400w" sizes="(min-width: 768px) 58vw, 50vw">` +
    `<img src="${hero?.src ?? `${base}.jpg`}" alt="" width="1400" height="867" fetchpriority="high" decoding="async" class="size-full object-cover object-[50%_45%]"></picture>` +
    '<div aria-hidden="true" class="absolute inset-0 bg-gradient-to-t from-canopy via-canopy/30 to-canopy/10 md:bg-gradient-to-r md:from-canopy md:via-canopy/25 md:to-transparent"></div></div>' +
    `<div class="${PAGE_FRAME} flex flex-col justify-end pt-48 pb-14 sm:pt-56 md:min-h-[calc(100dvh-4rem)] md:justify-center md:py-16"><div class="flex flex-col gap-4 md:w-[56%] lg:w-[52%]">` +
    `<p class="flex flex-col gap-1"><span class="font-label text-sm font-bold tracking-wide text-murram-light">${esc(copy.data.eyebrow)}</span>` +
    `<span class="font-display text-lg text-mist">${esc(copy.subtitle)}</span></p>` +
    `<h1 class="max-w-2xl text-display text-paper">${esc(copy.title)}</h1>` +
    '<div class="flex max-w-xl flex-col gap-3 text-base text-mist/90 md:text-lg">' +
    paras.map((p, i) => `<p${i === paras.length - 1 ? ' class="font-bold text-paper"' : ''}>${p.split('\n').map(esc).join('<br>')}</p>`).join('') +
    '</div></div></div></section>'
  );
};

export const renderShell = () => ({ header: header(), home: homeHero() });
