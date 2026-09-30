import React, { useState } from 'react';
import { useApp, ActiveTab } from '../context/AppContext';
import { Search, ArrowRight, ShoppingBag, Truck, LayoutDashboard, Menu, X } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { activeTab, setActiveTab, cartTotalQuantity, setIsCheckoutOpen } = useApp();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const goTo = (tab: ActiveTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const navLinks: { id: ActiveTab; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'map', label: 'Nursery Map' },
    { id: 'library', label: 'Tree Library' },
    { id: 'shadow', label: 'Impact' },
    { id: 'campaigns', label: 'Free Seedlings' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <div
              onClick={() => goTo('home')}
              className="flex cursor-pointer items-center gap-2"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-[#007A33]">
                <span className="text-lg font-black">N</span>
              </div>
              <span className="font-display text-2xl font-extrabold tracking-tight text-[#007A33]">
                Nursery Link
              </span>
            </div>

            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 md:flex">
              <Search className="h-4 w-4" />
              <input
                type="text"
                placeholder="Search species or nursery"
                className="w-52 border-0 bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 lg:flex">
            {navLinks.map((item) => {
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => goTo(item.id)}
                  className={`relative py-2 transition-colors ${
                    isActive ? 'text-[#007A33]' : 'hover:text-slate-900'
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-[#007A33]" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('map')}
              className="mr-1 hidden items-center gap-2 rounded-full bg-[#007A33] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00652d] xl:inline-flex"
            >
              Explore map
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => goTo('orders')}
              className={`rounded-full p-2 transition-colors hover:bg-slate-100 ${
                activeTab === 'orders' ? 'text-[#007A33]' : 'text-slate-700'
              }`}
              title="My orders & escrow"
            >
              <Truck className="h-5 w-5" />
            </button>

            <button
              onClick={() => goTo('dashboard')}
              className={`rounded-full p-2 transition-colors hover:bg-slate-100 ${
                activeTab === 'dashboard' ? 'text-[#007A33]' : 'text-slate-700'
              }`}
              title="Nursery manager dashboard"
            >
              <LayoutDashboard className="h-5 w-5" />
            </button>

            <button
              onClick={() => setIsCheckoutOpen(true)}
              className="relative rounded-full p-2 text-slate-700 transition-colors hover:bg-slate-100"
              title="Cart & escrow checkout"
            >
              <ShoppingBag className="h-5 w-5" />
              {cartTotalQuantity > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#007A33] px-1 text-[10px] font-bold text-white">
                  {cartTotalQuantity > 999 ? '999+' : cartTotalQuantity}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              className="rounded-full p-2 text-slate-700 transition-colors hover:bg-slate-100 lg:hidden"
              title="Menu"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <nav className="absolute inset-x-0 top-full border-b border-slate-200 bg-white px-4 py-2 shadow-md lg:hidden">
          {navLinks.map((item) => (
            <button
              key={item.id}
              onClick={() => goTo(item.id)}
              className={`block w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${
                activeTab === item.id ? 'bg-emerald-50 text-[#007A33]' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
};
