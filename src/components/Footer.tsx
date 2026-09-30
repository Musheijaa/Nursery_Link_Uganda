import React from 'react';
import { Trees, ShieldCheck, Mail, MapPin } from 'lucide-react';
import { useApp, ActiveTab } from '../context/AppContext';

const PLATFORM_LINKS: { tab: ActiveTab; label: string }[] = [
  { tab: 'map', label: 'Nursery Map' },
  { tab: 'library', label: 'Tree Library' },
  { tab: 'shadow', label: 'Impact Analytics' },
  { tab: 'campaigns', label: 'Free Seedling Campaigns' },
  { tab: 'orders', label: 'Orders & Escrow' },
  { tab: 'dashboard', label: 'Nursery Manager Portal' },
];

export const Footer: React.FC = () => {
  const { setActiveTab } = useApp();

  return (
    <footer className="bg-white border-t border-slate-200 text-slate-600 text-xs">
      
      {/* Uganda flag accent line */}
      <div className="h-1 w-full flex">
        <div className="flex-1 bg-slate-900"></div>
        <div className="flex-1 bg-yellow-400"></div>
        <div className="flex-1 bg-red-600"></div>
        <div className="flex-1 bg-slate-900"></div>
        <div className="flex-1 bg-yellow-400"></div>
        <div className="flex-1 bg-red-600"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* Col 1: Brand & Mission */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm">
                <Trees className="w-5 h-5" />
              </div>
              <span className="font-bold text-base text-slate-900 font-display">Nursery Link Uganda</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Uganda's Web-GIS marketplace connecting tree buyers, smallholder farmers, and carbon developers to certified nurseries with live inventory, distance-based delivery, and Mobile Money Escrow. Focus: Mukono District.
            </p>
            <div className="flex items-center space-x-2 text-[11px] text-emerald-800 font-bold pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>NFA & MAAIF Standards Aligned</span>
            </div>
          </div>

          {/* Col 2: Platform Modules */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">Platform Modules</h4>
            <ul className="space-y-2">
              {PLATFORM_LINKS.map(({ tab, label }) => (
                <li key={tab}>
                  <button onClick={() => setActiveTab(tab)} className="hover:text-emerald-700 font-medium transition-colors">
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Standards & Data Sources */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">Standards & Data Sources</h4>
            <ul className="space-y-2 text-[11px]">
              <li>National Forestry Authority (NFA) nursery standards</li>
              <li>MAAIF seedling quality guidelines</li>
              <li>Global Forest Watch (Hansen GFC) forest-loss data</li>
              <li>MTN MoMo &amp; Airtel Money (planned integration)</li>
            </ul>
          </div>

          {/* Col 4: National Contact & Support */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">Help & Forestry Desk</h4>
            <p className="text-[11px] text-slate-500">
              Need help with bulk procurement or nursery listing?
            </p>
            <div className="space-y-1.5 text-xs text-slate-600 font-medium">
              <div className="flex items-center space-x-2 text-slate-600">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>mukono@nurserylink.ug</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Kasangalabi, Nama Sub-County, Mukono</span>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom copyright */}
        <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
          <p>© {new Date().getFullYear()} Nursery Link Uganda. All rights reserved.</p>
          <div className="flex items-center space-x-4">
            <span className="text-emerald-700 font-bold">Powered by Open Forestry Data</span>
            <span>•</span>
            <span className="text-slate-500 font-medium">Coordinate-Accurate GIS</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
