import { Button, OfflineBanner, cn } from '@nurserylink/ui';
import { BookOpen, Ellipsis, Gift, HandHeart, House, LogIn, LogOut, Map as MapIcon, Menu, Newspaper, Package, Search, Sprout, type LucideIcon } from 'lucide-react';
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useMatches } from 'react-router';
import { en } from '../copy/en';
import { PAGE_FRAME } from '../lib/layout';
import { useOnline } from '../lib/online';
import { signOut, useSession } from '../lib/session';
import { useSiteSettings } from '../features/feedback/api';
import { AssistantHeaderButton, AssistantLauncher } from '../features/assistant/AssistantLauncher';
import { Logo } from './Logo';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Active only on this exact path (Home, which every path starts with) */
  end?: boolean;
  /** Shown as the bright Donate button */
  highlight?: boolean;
}

/** The main menu, in the client's order (brief §1) */
export const NAV: NavItem[] = [
  { to: '/', label: en.app.home, icon: House, end: true },
  { to: '/nurseries', label: en.nav.nurseries, icon: MapIcon },
  { to: '/library', label: en.nav.library, icon: BookOpen },
  { to: '/expert-services', label: en.nav.expertServices, icon: Sprout },
  { to: '/news', label: en.nav.news, icon: Newspaper },
  { to: '/giveaways', label: en.nav.giveaways, icon: Gift },
  { to: '/donate', label: en.nav.donate, icon: HandHeart, highlight: true },
];

/** Phones: these four sit in the bottom bar; "More" opens the menu with the rest (Donate highlighted) */
const BOTTOM_NAV = ['/', '/nurseries', '/library', '/giveaways'];

/** Donate stands out: bright leaf green with deep green text (AA), on the dark header and in menus */
export const donateLink = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full bg-sprout px-4 font-label text-label font-bold text-sprout-ink no-underline hover:bg-paper',
    isActive && 'ring-2 ring-paper ring-offset-2 ring-offset-canopy'
  );

const navLink = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex min-h-11 min-w-11 items-center gap-2 whitespace-nowrap rounded-sm px-3 font-label text-label no-underline xl:justify-center xl:px-2.5',
    isActive ? 'bg-paper/10 text-paper underline decoration-murram-light decoration-[3px] underline-offset-8' : 'text-paper/90 hover:bg-paper/10 hover:text-paper'
  );

const AccountLinks = ({ onNavigate, mobile = false }: { onNavigate?: () => void; mobile?: boolean }) => {
  const { user, restoring } = useSession();
  const location = useLocation();
  if (restoring) return <span className="min-h-11 w-24" aria-hidden />;
  if (!user) {
    return (
      <Link
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        onClick={onNavigate}
        className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-sm border border-paper/60 px-3 font-label text-label text-paper no-underline hover:bg-paper/10"
      >
        <LogIn aria-hidden className="size-5" />
        {en.nav.signIn}
      </Link>
    );
  }
  return (
    <div className={cn('flex items-center gap-1', mobile && 'flex-col items-stretch')}>
      {user.role === 'buyer' && (
        <NavLink to="/orders" className={navLink} onClick={onNavigate}>
          <Package aria-hidden className="size-5" />
          {en.nav.orders}
        </NavLink>
      )}
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          void signOut();
        }}
        className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-sm px-3 font-label text-label text-paper/90 hover:bg-paper/10 xl:px-2.5"
      >
        <LogOut aria-hidden className="size-5" />
        {en.nav.signOut}
      </button>
    </div>
  );
};

const AppToaster = lazy(() => import('./AppToaster'));
// The first-visit notice (sample data, survey): its dialog code loads after the first render
const WelcomeNotice = lazy(() => import('../features/feedback/WelcomeNotice'));

// The menu's dialog code loads on the first tap, not with the page (one less thing on a slow first load)
const MobileMenuDialog = lazy(() => import('./MobileMenu'));

/** The menu's open state is shared by the header button and the bottom bar's "More" */
const useMenu = () => {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const dialog = loaded && (
    <Suspense fallback={null}>
      <MobileMenuDialog open={open} onOpenChange={setOpen} nav={NAV} account={<AccountLinks onNavigate={() => { setOpen(false); }} mobile />} navLink={navLink} donateLink={donateLink} />
    </Suspense>
  );
  return { open, show: () => { setLoaded(true); setOpen(true); }, dialog };
};

const MobileMenu = ({ menu }: { menu: ReturnType<typeof useMenu> }) => (
  <Button
    variant="ghost"
    size="icon"
    className="text-paper hover:bg-paper/10 xl:hidden"
    aria-label={en.app.menu}
    aria-haspopup="dialog"
    aria-expanded={menu.open}
    onClick={menu.show}
  >
    <Menu aria-hidden />
  </Button>
);

/** Phones (under 768 px): the four main places and More, always at hand at the bottom */
export const BottomNav = ({ menu }: { menu: ReturnType<typeof useMenu> }) => (
  <nav aria-label={en.nav.bottom} className="on-dark fixed inset-x-0 bottom-0 z-30 border-t border-paper/15 bg-canopy pb-[env(safe-area-inset-bottom)] md:hidden">
    <ul className="grid grid-cols-5">
      {NAV.filter(n => BOTTOM_NAV.includes(n.to)).map(({ to, label, icon: Icon, end }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
              cn('flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-center text-[0.7rem] leading-tight font-bold no-underline', isActive ? 'text-paper' : 'text-paper/80')
            }
          >
            {({ isActive }) => (
              <>
                <Icon aria-hidden className={cn('size-5', isActive && 'text-murram-light')} />
                {label}
              </>
            )}
          </NavLink>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={menu.show}
          aria-haspopup="dialog"
          aria-expanded={menu.open}
          className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[0.7rem] leading-tight font-bold text-paper/80"
        >
          <Ellipsis aria-hidden className="size-5" />
          {en.nav.more}
        </button>
      </li>
    </ul>
  </nav>
);

export const Header = ({ menu }: { menu: ReturnType<typeof useMenu> }) => (
  <header className="on-dark sticky top-0 z-30 bg-canopy">
    <div className={cn(PAGE_FRAME, 'flex h-16 items-center justify-between gap-4')}>
      <Logo />
      <nav aria-label="Main" className="hidden items-center gap-0.5 xl:flex">
        {NAV.map(({ to, label, icon: Icon, end, highlight }) => (
          <NavLink key={to} to={to} end={end} className={highlight ? (s => cn(donateLink(s), 'ml-1.5')) : navLink}>
            {(end || highlight) && <Icon aria-hidden className="size-5" />}
            {/* Home is just the house icon until there's room for its name (signed-in links are wider) */}
            {end ? <span className="sr-only min-[1500px]:not-sr-only">{label}</span> : label}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-1">
        {/* The site-wide search: a page of its own, so it works the same on phones (brief §10.3) */}
        <Link to="/search" aria-label={en.siteSearch.open} className="flex size-11 items-center justify-center rounded-sm text-paper hover:bg-paper/10">
          <Search aria-hidden className="size-6" />
        </Link>
        <AssistantHeaderButton />
        <div className="hidden xl:block">
          <AccountLinks />
        </div>
        {/* Below xl the links are in the menu; a house button keeps Home one tap away */}
        <Link to="/" aria-label={en.app.home} className="flex size-11 items-center justify-center rounded-sm text-paper hover:bg-paper/10 xl:hidden">
          <House aria-hidden className="size-6" />
        </Link>
        <MobileMenu menu={menu} />
      </div>
    </div>
    {menu.dialog}
  </header>
);

/** A woven band (murram, sun, leaf, canopy), after the patterns of Ugandan baskets and bark cloth. */
const WovenBand = () => (
  <div
    aria-hidden
    className="h-2"
    style={{ background: 'repeating-linear-gradient(90deg, var(--color-murram) 0 28px, var(--color-sun) 28px 36px, var(--color-seedling) 36px 64px, var(--color-lake) 64px 72px, var(--color-sky) 72px 80px)' }}
  />
);

const footerLink = 'min-h-11 py-2.5 text-mist/90 underline decoration-mist/30 underline-offset-4 hover:text-paper hover:decoration-paper md:min-h-0 md:py-1';

export const Footer = () => {
  const site = useSiteSettings();
  const { pathname } = useLocation();
  return (
  <footer className="on-dark bg-canopy pb-[env(safe-area-inset-bottom)] text-mist">
    <WovenBand />
    <div className={cn(PAGE_FRAME, 'grid gap-8 py-10 md:grid-cols-[1.4fr_1fr_1fr]')}>
      <div className="flex flex-col gap-3">
        <Logo />
        <p className="max-w-sm text-sm text-mist/85">{en.footer.tagline}</p>
      </div>
      <nav aria-label={en.footer.explore} className="flex flex-col gap-1 text-sm">
        <p className="mb-1 font-bold text-paper">{en.footer.explore}</p>
        {NAV.map(({ to, label }) => (
          <Link key={to} to={to} className={footerLink}>{label}</Link>
        ))}
      </nav>
      <div className="flex flex-col gap-1 text-sm">
        <p className="mb-1 font-bold text-paper">{en.footer.about}</p>
        <p className="text-mist/85">{en.footer.pilot}</p>
        {site.data?.demo_notice && <p className="text-mist/85">{en.footer.sampleData}</p>}
        <Link to={`/feedback?from=${encodeURIComponent(pathname)}`} className={footerLink}>{en.footer.feedback}</Link>
        {site.data?.survey_url && <Link to="/survey" className={footerLink}>{en.footer.survey}</Link>}
        <Link to="/credits" className={footerLink}>{en.footer.credits}</Link>
        <p className="text-mist/90">{en.footer.mapData}</p>
      </div>
    </div>
  </footer>
  );
};

/** Shared page frame. `fullBleed` pages (the map) manage their own width and have no footer. */
export const Layout = ({ children }: { children?: ReactNode }) => {
  const online = useOnline();
  // Routes set handle: { fullBleed: true } (the map: whole screen, no footer) or { bare: true }
  // (Home: edge-to-edge sections that manage their own width, with the footer)
  const handles = useMatches().map(m => (m.handle ?? {}) as { fullBleed?: boolean; bare?: boolean });
  const fullBleed = handles.some(h => h.fullBleed === true);
  const bare = fullBleed || handles.some(h => h.bare === true);
  const { pathname } = useLocation();
  // Pages with their own bottom bars (map sheet, checkout's Next, the nursery's order map) get no
  // floating button; the header's "Ask" still opens the assistant there
  const ownBottomBar = /^\/nurseries\/[^/]+\/order|^\/o\//.test(pathname);
  const floatingAssistant = !fullBleed && !ownBottomBar;
  // The phone bottom bar on every page except those with their own (checkout, order map). The map
  // page sizes itself to sit above it.
  const bottomNav = !ownBottomBar;
  const menu = useMenu();
  return (
    <div className={cn('flex min-h-dvh flex-col overflow-x-clip', bottomNav && !fullBleed && 'pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0')}>
      <a href="#main" className="sr-only z-50 bg-paper p-3 font-bold focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        {en.app.skipToContent}
      </a>
      <Header menu={menu} />
      {!online && <OfflineBanner>{en.offline.banner}</OfflineBanner>}
      <main id="main" tabIndex={-1} className={cn('flex-1 outline-none', !bare && cn(PAGE_FRAME, 'py-6 md:py-8'))}>
        {children ?? <Outlet />}
      </main>
      {!fullBleed && <Footer />}
      {/* Loads after the first render; toasts raised before then wait in their store */}
      <Suspense fallback={null}><AppToaster /></Suspense>
      <Suspense fallback={null}><WelcomeNotice /></Suspense>
      <AssistantLauncher floating={floatingAssistant} />
      {bottomNav && <BottomNav menu={menu} />}
      <ScrollRestoration />
    </div>
  );
};
