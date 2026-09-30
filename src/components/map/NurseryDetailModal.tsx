import React, { useState } from 'react';
import { Nursery, SeedlingBatch } from '../../types';
import { useApp } from '../../context/AppContext';
import { distanceKm as getDistanceKm } from '../../utils/geo';
import { 
  X, 
  MapPin, 
  Phone, 
  Mail, 
  ShieldCheck, 
  Trees, 
  Droplets, 
  Mountain, 
  Plus, 
  Minus, 
  ShoppingBag, 
  Star, 
  Calendar, 
  Truck,
  Check
} from 'lucide-react';

interface NurseryDetailModalProps {
  nursery: Nursery;
  onClose: () => void;
}

export const NurseryDetailModal: React.FC<NurseryDetailModalProps> = ({ nursery, onClose }) => {
  const { addToCart, setIsCheckoutOpen, userLocation } = useApp();
  const [quantities, setQuantities] = useState<{ [batchId: string]: number }>({});

  const distanceKm = getDistanceKm(userLocation, nursery.coordinates).toFixed(1);

  const handleQtyChange = (batchId: string, delta: number, max: number) => {
    const current = quantities[batchId] || 50;
    const next = Math.max(10, Math.min(max, current + delta));
    setQuantities(prev => ({ ...prev, [batchId]: next }));
  };

  const handleAddBatch = (batch: SeedlingBatch) => {
    const qty = quantities[batch.id] || 50;
    addToCart(nursery, batch, qty);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-8 text-slate-900">
        
        {/* Modal Header */}
        <div className="relative p-6 bg-slate-50 border-b border-slate-200">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200 transition-colors shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap items-start justify-between gap-4 pr-12">
            <div>
              <div className="flex items-center space-x-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-[#007A33] border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Verified
                </span>
                <span className="text-xs font-mono text-slate-500">
                  Accreditation: {nursery.accreditationNumber}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 font-display">{nursery.name}</h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 mt-2 font-medium">
                <span className="flex items-center gap-1 text-[#007A33]">
                  <MapPin className="w-3.5 h-3.5" />
                  {nursery.village}, {nursery.subCounty} Sub-County, Mukono
                </span>
                <span className="flex items-center gap-1 text-slate-700">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                  {nursery.rating} ({nursery.reviewsCount} reviews)
                </span>
                <span className="flex items-center gap-1 text-slate-600">
                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                  ~{distanceKm} km to Mukono planting site
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
          
          {/* Top Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                <Trees className="w-3.5 h-3.5 text-[#007A33]" /> Current Stock
              </span>
              <p className="text-xl font-extrabold text-[#007A33] font-display mt-0.5">
                {nursery.currentStockTotal.toLocaleString()}
              </p>
              <span className="text-[10px] text-slate-400">Ready for dispatch</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-[#007A33]" /> Water Source
              </span>
              <p className="text-xs font-bold text-slate-800 mt-1 truncate">
                {nursery.waterSource}
              </p>
              <span className="text-[10px] text-slate-400">Reliable year-round</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                <Mountain className="w-3.5 h-3.5 text-[#007A33]" /> Eco-Zone
              </span>
              <p className="text-xs font-bold text-slate-800 mt-1 truncate">
                {nursery.ecologicalZone}
              </p>
              <span className="text-[10px] text-slate-400">Alt: {nursery.elevationMeters}m</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#007A33]" /> Verified Since
              </span>
              <p className="text-xs font-bold text-slate-800 mt-1">
                {new Date(nursery.verifiedSince).getFullYear()}
              </p>
              <span className="text-[10px] text-slate-400">Audited Provider</span>
            </div>
          </div>

          {/* Live Seedling Batches */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-slate-900 font-display">
              Live Seedling Batches ({nursery.batches.length})
            </h3>

            <div className="space-y-3">
              {nursery.batches.map((batch) => {
                const qty = quantities[batch.id] || 50;
                const batchTotal = qty * batch.unitPriceUGX;

                return (
                  <div 
                    key={batch.id} 
                    className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-slate-900 text-base">{batch.speciesName}</h4>
                        <span className="text-[10px] font-mono text-slate-400">ID: {batch.batchCode}</span>
                      </div>
                      <p className="text-xs italic text-slate-500 font-serif">{batch.botanicalName}</p>
                      
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-2 font-medium">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {batch.pottingType}
                        </span>
                        <span>Age: <strong className="text-slate-900">{batch.ageMonths} mos</strong></span>
                        <span>Stock: <strong className="text-[#007A33] font-mono">{batch.quantityAvailable.toLocaleString()}</strong></span>
                      </div>
                    </div>

                    {/* Pricing & Add to Cart Controls */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <div className="text-left sm:text-right">
                        <div className="text-sm font-bold text-[#007A33] font-mono">
                          UGX {batch.unitPriceUGX.toLocaleString()} <span className="text-xs text-slate-400 font-normal">/ seedling</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Subtotal: <span className="font-bold text-slate-900 font-mono">UGX {batchTotal.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center space-x-1 bg-slate-100 border border-slate-200 rounded-xl p-1">
                        <button
                          onClick={() => handleQtyChange(batch.id, -25, batch.quantityAvailable)}
                          className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors shadow-sm"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          value={qty}
                          onChange={(e) => setQuantities(prev => ({ ...prev, [batch.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                          className="w-14 text-center bg-transparent font-mono text-xs font-bold text-slate-900 focus:outline-none"
                        />
                        <button
                          onClick={() => handleQtyChange(batch.id, 25, batch.quantityAvailable)}
                          className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Add Button */}
                      <button
                        onClick={() => handleAddBatch(batch)}
                        className="px-4 py-2.5 rounded-xl bg-[#007A33] hover:bg-[#00662A] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        Add to Cart
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Checkout Action Bar */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs text-slate-500 font-semibold">Nursery Operator & Dispatch Logistics:</span>
              <p className="text-sm font-bold text-slate-900">{nursery.operatorName}</p>
              <div className="flex items-center gap-4 text-xs text-slate-600 mt-1 font-medium">
                <span className="flex items-center gap-1 text-[#007A33] font-semibold">
                  <Phone className="w-3 h-3" /> {nursery.phone}
                </span>
                <span className="flex items-center gap-1 text-slate-600">
                  <Mail className="w-3 h-3" /> {nursery.email}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                setIsCheckoutOpen(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-[#007A33] hover:bg-[#00662A] text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              Proceed to Mobile Money Escrow
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
