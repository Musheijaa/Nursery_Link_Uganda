import React from 'react';
import { useApp, ActiveTab } from '../context/AppContext';
import { 
  Search, 
  Bell, 
  User, 
  ShoppingBag 
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    cartTotalQuantity, 
    setIsCheckoutOpen 
  } = useApp();

  const navLinks: { id: ActiveTab; label: string }[] = [
    { id: 'map', label: 'GIS Map' },
    { id: 'library', label: 'Tree Library' },
    { id: 'shadow', label: 'Analytics' },
    { id: 'campaigns', label: 'Free Seedlings' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Left: Logo & Search Bar */}
          <div className="flex items-center space-x-6">
            
            {/* Nursery Link Logo */}
            <div 
              onClick={() => setActiveTab('map')}
              className="cursor-pointer group flex items-center"
            >
              <span className="font-display font-extrabold text-2xl tracking-tight text-[#007A33]">
                Nursery Link
              </span>
            </div>

            {/* Top Search Bar (Pill) */}
            <div className="relative hidden md:block w-64 lg:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 bg-slate-100/80 border border-transparent rounded-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-300 transition-all"
              />
            </div>
          </div>

          {/* Center/Right: Navigation Tabs */}
          <nav className="flex items-center space-x-6 sm:space-x-8 text-xs font-semibold">
            {navLinks.map((item) => {
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`relative py-5 transition-colors ${
                    isActive
                      ? 'text-[#007A33] font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007A33] rounded-full"></span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Far Right: Icons & Actions */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            
            {/* Cart Button */}
            <button
              onClick={() => setIsCheckoutOpen(true)}
              className="relative p-2 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
              title="Cart & Escrow Checkout"
            >
              <ShoppingBag className="w-5 h-5 text-slate-700" />
              {cartTotalQuantity > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#007A33] text-white font-bold text-[10px] flex items-center justify-center">
                  {cartTotalQuantity}
                </span>
              )}
            </button>

            {/* Notifications Bell */}
            <button 
              className="p-2 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5 text-slate-700" />
            </button>

            {/* User Profile Avatar */}
            <button 
              onClick={() => setActiveTab('dashboard')}
              className="p-1 rounded-full hover:ring-2 hover:ring-[#007A33] transition-all"
              title="Mukono District Manager"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-700">
                <User className="w-4 h-4" />
              </div>
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
