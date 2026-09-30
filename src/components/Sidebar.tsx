import React from 'react';
import { useApp } from '../context/AppContext';
import { Package, CreditCard, Plus } from 'lucide-react';

export type ManagerSection = 'inventory' | 'escrow';

interface SidebarProps {
  activeSection: ManagerSection;
  onOpenAddBatch?: () => void;
}

const SECTIONS: { id: ManagerSection; label: string; icon: typeof Package }[] = [
  { id: 'inventory', label: 'Inventory Management', icon: Package },
  { id: 'escrow', label: 'Escrow Wallet', icon: CreditCard },
];

/** Navigation for the nursery manager area (inventory dashboard + escrow/orders). */
export const Sidebar: React.FC<SidebarProps> = ({ activeSection, onOpenAddBatch }) => {
  const { setActiveTab } = useApp();

  const handleSectionClick = (section: ManagerSection) => {
    setActiveTab(section === 'inventory' ? 'dashboard' : 'orders');
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between p-5 shrink-0 min-h-[calc(100vh-4rem)]">
      <nav className="space-y-1.5 text-xs font-semibold pt-1">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleSectionClick(id)}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all ${
              activeSection === id
                ? 'bg-[#007A33] text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {onOpenAddBatch && (
        <div className="pt-6">
          <button
            onClick={onOpenAddBatch}
            className="w-full py-2.5 px-4 rounded-xl bg-[#007A33] hover:bg-[#00662A] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Batch</span>
          </button>
        </div>
      )}
    </aside>
  );
};
