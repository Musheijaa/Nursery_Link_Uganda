import React, { useState } from 'react';
import { Menu, ShoppingCart, X } from 'lucide-react';
import { Page, useApp } from '../../context/AppContext';
import { useMe } from '../../api/hooks';
import { Container } from '../ui';
import { Logo } from './Logo';

const MAIN_LINKS: { page: Page; label: string }[] = [
  { page: 'seedlings', label: 'Find seedlings' },
  { page: 'trees', label: 'Tree guide' },
  { page: 'programmes', label: 'Free seedlings' },
  { page: 'gaps', label: 'Planting gaps' },
];

const secondaryLinks = (role?: string): { page: Page; label: string }[] => [
  { page: 'orders', label: 'My orders' },
  { page: 'nursery', label: role === 'nursery_owner' ? 'My nursery' : 'For nurseries' },
  ...(role === 'admin' ? [{ page: 'admin' as Page, label: 'Admin' }] : []),
];

export const Header: React.FC = () => {
  const { page, navigate, cartCount, setCartOpen } = useApp();
  const { data: user } = useMe();
  const SECONDARY_LINKS = secondaryLinks(user?.role);
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (target: Page) => {
    navigate(target);
    setMenuOpen(false);
  };

  const linkClass = (target: Page) =>
    `text-sm font-medium transition-colors ${page === target ? 'text-brand-700' : 'text-stone-600 hover:text-stone-900'}`;

  return (
    <header className="sticky top-0 z-40">
      <div className="bg-brand-900 px-4 py-1.5 text-center text-xs text-brand-100">
        Demo version: the nurseries, people, prices and programmes shown are examples.
      </div>

      <div className="relative border-b border-stone-200 bg-white">
        <Container className="flex h-16 items-center justify-between gap-6">
          <Logo onClick={() => go('home')} />

          <nav className="hidden items-center gap-6 lg:flex" aria-label="Main">
            {MAIN_LINKS.map(link => (
              <button key={link.page} onClick={() => go(link.page)} className={linkClass(link.page)} aria-current={page === link.page ? 'page' : undefined}>
                {link.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1 sm:gap-4">
            {SECONDARY_LINKS.map(link => (
              <button key={link.page} onClick={() => go(link.page)} className={`hidden md:block ${linkClass(link.page)}`}>
                {link.label}
              </button>
            ))}

            <button
              onClick={() => setCartOpen(true)}
              className="relative inline-flex h-10 items-center gap-2 rounded-md border border-stone-300 px-3 text-sm font-medium text-stone-800 hover:bg-stone-50"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Cart</span>
              {cartCount > 0 && (
                <span className="rounded bg-brand-700 px-1.5 text-xs font-semibold text-white">
                  {cartCount > 9999 ? '9999+' : cartCount.toLocaleString()}
                </span>
              )}
            </button>

            <button
              onClick={() => setMenuOpen(open => !open)}
              className="rounded-md p-2 text-stone-700 hover:bg-stone-100 lg:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </Container>

        {menuOpen && (
          <nav className="absolute inset-x-0 top-full border-b border-stone-200 bg-white shadow-md lg:hidden" aria-label="Mobile">
            <Container className="py-2">
              {[...MAIN_LINKS, ...SECONDARY_LINKS].map(link => (
                <button
                  key={link.page}
                  onClick={() => go(link.page)}
                  className={`block w-full rounded-md px-3 py-3 text-left text-base font-medium ${
                    page === link.page ? 'bg-brand-50 text-brand-800' : 'text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  {link.label}
                </button>
              ))}
            </Container>
          </nav>
        )}
      </div>
    </header>
  );
};
