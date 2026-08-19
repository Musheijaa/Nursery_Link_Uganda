import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  Package, 
  CreditCard, 
  ShieldCheck, 
  Plus, 
  Settings, 
  HelpCircle
} from 'lucide-react';

interface SidebarProps {
  onOpenAddBatch?: () => void;
  activeSidebarTab?: 'inventory' | 'escrow' | 'accreditation';
  onSelectSidebarTab?: (tab: 'inventory' | 'escrow' | 'accreditation') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  onOpenAddBatch, 
  activeSidebarTab = 'inventory',
  onSelectSidebarTab 
}) => {
  const { setActiveTab } = useApp();

  const handleTabClick = (tab: 'inventory' | 'escrow' | 'accreditation') => {
    if (onSelectSidebarTab) {
      onSelectSidebarTab(tab);
    }
    if (tab === 'inventory') {
      setActiveTab('dashboard');
    } else if (tab === 'escrow') {
      setActiveTab('orders');
    } else {
      setActiveTab('dashboard');
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between p-5 shrink-0 min-h-[calc(100vh-4rem)]">
      
      {/* Top Profile Header */}
      <div className="space-y-6">
        
        {/* District User Card */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center font-bold text-emerald-800 text-sm overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80" 
              alt="Mukono Lead" 
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm leading-tight">Mukono District</h3>
            <p className="text-[11px] text-slate-500 font-medium">Regional Reforestation Hub</p>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="space-y-1.5 text-xs font-semibold">
          <button
            onClick={() => handleTabClick('inventory')}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all ${
              activeSidebarTab === 'inventory'
                ? 'bg-[#007A33] text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Inventory Management</span>
          </button>

          <button
            onClick={() => handleTabClick('escrow')}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all ${
              activeSidebarTab === 'escrow'
                ? 'bg-[#007A33] text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Escrow Wallet</span>
          </button>

          <button
            onClick={() => handleTabClick('accreditation')}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all ${
              activeSidebarTab === 'accreditation'
                ? 'bg-[#007A33] text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Accreditation Status</span>
          </button>
        </nav>
      </div>

      {/* Middle/Bottom Action Button & Links */}
      <div className="space-y-4 pt-6">
        
        {/* + Add New Batch Pill Button */}
        <button
          onClick={onOpenAddBatch}
          className="w-full py-2.5 px-4 rounded-xl bg-[#007A33] hover:bg-[#00662A] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Batch</span>
        </button>

        <div className="pt-3 border-t border-slate-100 space-y-1 text-xs font-semibold text-slate-600">
          <button className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors">
            <Settings className="w-4 h-4 text-slate-500" />
            <span>Settings</span>
          </button>

          <button className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors">
            <HelpCircle className="w-4 h-4 text-slate-500" />
            <span>Support</span>
          </button>
        </div>

      </div>

    </aside>
  );
};
