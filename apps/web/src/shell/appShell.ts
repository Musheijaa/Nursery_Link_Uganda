import { en } from '../copy/en.ts';
import { IMAGES } from '../data/images.ts';

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
  { to: '/nurseries', label: en.nav.nurseries },
  { to: '/free-seedlings', label: en.nav.freeSeedlings },
  { to: '/library', label: en.nav.library },
  { to: '/news', label: en.nav.news },
];

const MARK =
  '<svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true" class="shrink-0 rounded-[9px] ring-1 ring-paper/15">' +
  '<rect width="32" height="32" rx="8" fill="#123d2a"/><circle cx="24.5" cy="8" r="3" fill="#f2b705"/>' +
  '<path d="M4 27.5c2.6-4.4 7.2-6.8 12-6.8s9.4 2.4 12 6.8Z" fill="#b8501f"/>' +
  '<path d="M16 21.5v-7.5" stroke="#faf6ee" stroke-width="2" stroke-linecap="round"/>' +
  '<path d="M16 14.5c.4-4.6 3.4-7.6 8-8.1-.3 4.8-3.4 7.9-8 8.1Z" fill="#faf6ee"/>' +
  '<path d="M16 16.8c-.3-3.7-2.8-6.2-6.6-6.6.2 3.9 2.8 6.4 6.6 6.6Z" fill="#7cc48a"/></svg>';

/** The header bar (every page). Links work before the app loads; the account area is left empty. */
const header = () =>
  '<header class="on-dark sticky top-0 z-30 bg-canopy"><div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">' +
  `<a href="/" class="flex min-h-11 items-center gap-2.5 text-paper no-underline" aria-label="${esc(`${en.app.fullName}, ${en.app.home}`)}">${MARK}` +
  `<span class="flex flex-col leading-none"><span class="font-display text-xl font-semibold tracking-tight">${esc(en.app.name)}</span>` +
  `<span class="text-xs font-bold text-murram-light">${esc(en.footer.country)}</span></span></a>` +
  '<nav aria-label="Main" class="hidden items-center gap-1 md:flex">' +
  NAV.map(n => `<a href="${n.to}" class="flex min-h-11 items-center gap-2 rounded-sm px-3 font-bold no-underline text-paper/90">${esc(n.label)}</a>`).join('') +
  '</nav><span class="size-11"></span></div></header>';

/** Home's hero: the photo, eyebrow, headline and lead (the search and links arrive with the app). */
const homeHero = () => {
  const hero = IMAGES['greenhouse-kamuli'];
  const base = '/images/greenhouse-kamuli';
  return (
    '<section class="on-dark relative isolate overflow-hidden bg-canopy">' +
    '<div class="absolute inset-x-0 top-0 -z-10 h-72 sm:h-80 md:inset-y-0 md:right-0 md:left-auto md:h-auto md:w-[62%]">' +
    `<picture class="contents"><source type="image/webp" srcset="${base}-480.webp 480w, ${base}-960.webp 960w, ${base}-1400.webp 1400w" sizes="(min-width: 768px) 62vw, 50vw">` +
    `<img src="${hero?.src ?? `${base}.jpg`}" alt="" width="1400" height="867" fetchpriority="high" decoding="async" class="size-full object-cover object-[50%_45%]"></picture>` +
    '<div aria-hidden="true" class="absolute inset-0 bg-gradient-to-t from-canopy via-canopy/30 to-canopy/10 md:bg-gradient-to-r md:from-canopy md:via-canopy/25 md:to-transparent"></div>' +
    '<div aria-hidden="true" class="absolute inset-x-0 bottom-0 hidden h-24 bg-gradient-to-t from-canopy/70 to-transparent md:block"></div></div>' +
    '<div class="mx-auto w-full max-w-7xl px-4 md:px-6 flex flex-col gap-4 pt-56 pb-14 sm:pt-64 md:min-h-[36rem] md:justify-center md:py-16 md:pr-[45%] lg:pr-[48%]">' +
    `<p class="flex items-center gap-2 self-start rounded-full bg-paper/10 px-3 py-1 text-sm font-bold text-mist ring-1 ring-paper/25"><span aria-hidden="true" class="size-2 rounded-full bg-sky"></span>${esc(en.home.eyebrow)}</p>` +
    `<h1 class="max-w-xl text-[2rem] leading-[1.1] text-paper md:text-[2.5rem] lg:text-[2.75rem]">${esc(en.home.title)} <span class="text-murram-light">${esc(en.home.titleAccent)}</span></h1>` +
    `<p class="max-w-lg text-base text-mist/90 md:text-lg">${esc(en.home.lead)}</p>` +
    '</div></section>'
  );
};

export const renderShell = () => ({ header: header(), home: homeHero() });
