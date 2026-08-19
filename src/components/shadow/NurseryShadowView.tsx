import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Sidebar } from '../Sidebar';
import { 
  TrendingDown, 
  Flame, 
  Trees, 
  ShieldAlert, 
  Download, 
  ArrowUpRight, 
  Layers, 
  Sliders 
} from 'lucide-react';

export const NurseryShadowView: React.FC = () => {
  const {
    hotspots,
    districtDeficits,
    nurseries,
    serviceRadiusKm,
    setServiceRadiusKm,
    setActiveTab,
    setFocusedMapCoords,
    showToast
  } = useApp();

  const [selectedHotspot, setSelectedHotspot] = useState<typeof hotspots[0] | null>(hotspots[0]);
  const totalForestLoss = hotspots.reduce((s, h) => s + h.forestLossHectaresPast3Yrs, 0);
  const totalDeficit = districtDeficits.reduce((s, d) => s + d.annualSeedlingDeficit, 0);

  const handleExportBrief = () => {
    showToast('Downloaded Mukono District Nursery Shadow Report (.txt)');
  };

  return (
    <div className="flex bg-slate-50 min-h-[calc(100vh-4rem)]">
      
      {/* Left Navigation Sidebar */}
      <Sidebar />

      {/* Main Analytics Content */}
      <div className="flex-1 p-6 lg:p-10 space-y-8 max-w-6xl">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 font-display tracking-tight">
              Mukono Deforestation & Supply Analytics
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              GIS supply-gap analysis combining satellite forest loss data with certified nursery service zones.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportBrief}
              className="py-2.5 px-4 rounded-xl bg-[#007A33] hover:bg-[#00662A] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Export Policy Brief</span>
            </button>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
            <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-red-600" /> Forest Loss in Mukono
            </span>
            <div className="text-3xl font-extrabold text-red-600 font-display">
              {totalForestLoss.toLocaleString()} <span className="text-sm font-sans font-normal text-slate-400">ha</span>
            </div>
            <p className="text-[11px] text-slate-400">Mabira fringe & Lake Victoria basin</p>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
            <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600" /> Seedling Deficit
            </span>
            <div className="text-3xl font-extrabold text-amber-600 font-display">
              {(totalDeficit / 1000).toFixed(0)}k <span className="text-sm font-sans font-normal text-slate-400">/ yr</span>
            </div>
            <p className="text-[11px] text-slate-400">Unmet agroforestry planting demand</p>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
            <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
              <Trees className="w-4 h-4 text-[#007A33]" /> Active Nurseries
            </span>
            <div className="text-3xl font-extrabold text-[#007A33] font-display">
              {nurseries.length} <span className="text-sm font-sans font-normal text-slate-400">Hubs</span>
            </div>
            <p className="text-[11px] text-slate-400">Average road radius: {serviceRadiusKm} km</p>
          </div>
        </div>

        {/* Hotspots & Sub-County Table Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Hotspots List (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900 font-display">
              Mukono Hotspots
            </h2>

            <div className="space-y-3">
              {hotspots.map((h) => (
                <div
                  key={h.id}
                  onClick={() => setSelectedHotspot(h)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer bg-white ${
                    selectedHotspot?.id === h.id
                      ? 'border-red-500 ring-1 ring-red-500 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <h4 className="font-bold text-sm text-slate-900">{h.name}</h4>
                    <span className="text-xs font-bold text-red-600 font-mono">
                      GAP {h.priorityScore}%
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-1">
                    3-Yr Loss: <strong className="text-slate-800">{h.forestLossHectaresPast3Yrs.toLocaleString()} ha</strong>
                  </p>

                  <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 text-xs">
                    <span className="text-[#007A33] font-medium text-[11px]">
                      Nearest: {h.nearestNurseryDistanceKm} km
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFocusedMapCoords(h.coordinates);
                        setActiveTab('map');
                      }}
                      className="text-[11px] font-bold text-slate-700 hover:text-[#007A33] flex items-center gap-1"
                    >
                      <span>Map</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Sub-County Opportunity Index (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-base font-bold text-slate-900 font-display">
              Sub-County Opportunity Index
            </h2>

            <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="p-4">Sub-County</th>
                    <th className="p-4">Loss</th>
                    <th className="p-4">Deficit</th>
                    <th className="p-4 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {districtDeficits.map((d) => (
                    <tr key={d.district} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4 font-bold text-slate-900">{d.district}</td>
                      <td className="p-4 font-mono text-red-600">{d.forestCoverLossHectares.toLocaleString()} ha</td>
                      <td className="p-4 font-mono text-amber-700">{(d.annualSeedlingDeficit / 1000).toFixed(0)}k</td>
                      <td className="p-4 text-right">
                        <span className="font-mono font-bold text-[#007A33] bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          {d.opportunityScore}/100
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
