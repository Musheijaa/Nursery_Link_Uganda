import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Sidebar } from '../Sidebar';
import { History, Check, Clock, X, Sprout } from 'lucide-react';
import confetti from 'canvas-confetti';
import { EscrowStatus, PottingType } from '../../types';

// Statuses where the buyer has paid but funds have not yet been released to the nursery
const HELD_ESCROW_STATUSES: EscrowStatus[] = [
  'Escrow Funded',
  'Batch Preparation',
  'In Transit',
  'Delivered - Inspection Period',
  'Dispute Raised'
];

const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

export const ManagerDashboard: React.FC = () => {
  const { 
    nurseries, 
    species, 
    orders, 
    addNewBatch, 
    setActiveTab 
  } = useApp();

  const [isAddBatchOpen, setIsAddBatchOpen] = useState(false);
  const [newSpeciesId, setNewSpeciesId] = useState(species[0]?.id || '');
  const [newPottingType, setNewPottingType] = useState<PottingType>('Poly-tube Potted');
  const [newAgeMonths, setNewAgeMonths] = useState<number>(4);
  const [newStock, setNewStock] = useState<number>(50000);
  const [newUnitPrice, setNewUnitPrice] = useState<number>(1000);

  // No auth yet: the manager view is scoped to the first nursery in the registry
  const activeNursery = nurseries[0];

  const heldEscrowUGX = orders
    .filter(o => o.nurseryId === activeNursery.id && HELD_ESCROW_STATUSES.includes(o.escrowStatus))
    .reduce((sum, o) => sum + o.totalAmountUGX, 0);

  const handleCreateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const sp = species.find(s => s.id === newSpeciesId);
    if (!sp) return;

    addNewBatch(activeNursery.id, {
      speciesId: sp.id,
      speciesName: sp.commonName,
      botanicalName: sp.botanicalName,
      category: sp.category,
      pottingType: newPottingType,
      ageMonths: newAgeMonths,
      heightCm: 35,
      germinationRatePercent: 94,
      unitPriceUGX: newUnitPrice,
      quantityAvailable: newStock,
      batchCode: `BT-09${Math.floor(Math.random() * 90) + 10}${String.fromCharCode(65 + Math.floor(Math.random() * 6))}`,
      status: 'Verified',
      escrowCommitmentPercent: 50,
      certifiedMotherTree: true,
      readyForPlanting: true
    });

    setIsAddBatchOpen(false);
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  return (
    <div className="flex bg-slate-50 min-h-[calc(100vh-4rem)]">
      
      <Sidebar activeSection="inventory" onOpenAddBatch={() => setIsAddBatchOpen(true)} />

      {/* Main Content Area */}
      <div className="flex-1 p-6 lg:p-10 space-y-8 max-w-6xl">
        
        {/* Header & Escrow Summary */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 font-display tracking-tight">
              Inventory & Escrow
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              {activeNursery.name} · Manage your seedling stock and monitor escrow disbursements.
            </p>
          </div>

          {/* Total Escrow Card */}
          <div className="p-4 px-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center space-x-6">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                HELD IN ESCROW
              </span>
              <div className="text-2xl lg:text-3xl font-extrabold text-[#007A33] font-display">
                UGX {compactNumber.format(heldEscrowUGX)}
              </div>
            </div>

            <div className="h-10 w-[1px] bg-slate-200"></div>

            <button
              onClick={() => setActiveTab('orders')}
              className="px-4 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-[#007A33] font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <History className="w-4 h-4 text-[#007A33]" />
              <span>View Payouts</span>
            </button>
          </div>
        </div>

        {/* Live Seedling Batches */}
        <div className="flex items-center space-x-2 pt-2 border-b border-slate-200 pb-4">
          <Sprout className="w-5 h-5 text-[#007A33]" />
          <h2 className="text-lg font-bold text-slate-900 font-display">
            Live Seedling Batches ({activeNursery.batches.length})
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeNursery.batches.map((batch) => {
            const isVerified = batch.status === 'Verified';

            return (
              <div
                key={batch.id}
                className="rounded-3xl bg-white border border-slate-200 p-6 flex flex-col justify-between space-y-6 shadow-sm hover:border-slate-300 transition-all"
              >
                {/* Top Badge & ID */}
                <div>
                  <div className="flex items-center space-x-2 text-xs">
                    {isVerified ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#007A33] border border-emerald-200 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3 text-[#007A33]" /> Verified
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" /> Pending
                      </span>
                    )}
                    <span className="font-mono text-slate-500 text-[11px] font-semibold">
                      ID: {batch.batchCode}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 font-display mt-3">
                    {batch.speciesName}
                  </h3>
                </div>

                {/* 2 Stat Boxes Side-by-Side */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 font-semibold block leading-tight">
                      Stock Available
                    </span>
                    <div className="text-2xl font-extrabold text-[#007A33] font-display mt-1">
                      {batch.quantityAvailable.toLocaleString()}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 font-semibold block leading-tight">
                      Age
                    </span>
                    <div className="text-xl font-extrabold text-slate-900 font-display mt-1">
                      {batch.ageMonths} <span className="text-xs font-normal text-slate-500">Months</span>
                    </div>
                  </div>
                </div>

                {/* Escrow Commitment Progress Bar */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">Escrow Commitment</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {batch.escrowCommitmentPercent || 50}%
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#007A33]"
                      style={{ width: `${batch.escrowCommitmentPercent || 50}%` }}
                    ></div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>

      </div>

      {/* Add New Batch Modal */}
      {isAddBatchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 font-display">Add Seedling Batch</h3>
              <button onClick={() => setIsAddBatchOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Tree Species</label>
                <select
                  value={newSpeciesId}
                  onChange={(e) => setNewSpeciesId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  {species.map(s => (
                    <option key={s.id} value={s.id}>{s.commonName} ({s.botanicalName})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Potting Method</label>
                  <select
                    value={newPottingType}
                    onChange={(e) => setNewPottingType(e.target.value as PottingType)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="Poly-tube Potted">Poly-tube Potted</option>
                    <option value="Root-Trainer Plug">Root-Trainer Plug</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Age (Months)</label>
                  <input
                    type="number"
                    value={newAgeMonths}
                    onChange={(e) => setNewAgeMonths(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    value={newStock}
                    onChange={(e) => setNewStock(parseInt(e.target.value) || 1000)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-[#007A33]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Unit Price (UGX)</label>
                  <input
                    type="number"
                    value={newUnitPrice}
                    onChange={(e) => setNewUnitPrice(parseInt(e.target.value) || 500)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#007A33] hover:bg-[#00662A] text-white font-bold text-xs mt-2 transition-all shadow-sm"
              >
                Register in Live Batches
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
