import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, SlidersHorizontal, MapPin, Check, Compass } from 'lucide-react';

export const TreeLibraryView: React.FC = () => {
  const { 
    species, 
    setTargetSpeciesFilter, 
    setActiveTab, 
    showToast 
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>('All');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const filteredSpecies = species.filter((sp) => {
    const matchesSearch = 
      searchQuery === '' ||
      sp.commonName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sp.botanicalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Object.values(sp.localNames).join(' ').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = 
      selectedFilterCategory === 'All' ||
      (selectedFilterCategory === 'Native' && sp.isNative) ||
      (selectedFilterCategory === 'Compatible' && !sp.isNative);

    return matchesSearch && matchesCategory;
  });

  const handleFindInMukono = (speciesId: string) => {
    setTargetSpeciesFilter(speciesId);
    setActiveTab('map');
    showToast(`Filtering Mukono nurseries stocking ${species.find(s => s.id === speciesId)?.commonName}`);
  };

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-7">

        {/* Header & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 font-display tracking-tight">
              Species Registry
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1 max-w-lg">
              Explore our curated library of native and ecologically compatible tree species suitable for reforestation in your region.
            </p>
          </div>

          {/* Search species input & Filters button */}
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                placeholder="Search species..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-full text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#007A33] shadow-sm"
              />
            </div>

            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="py-2 px-4 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 shadow-sm hover:bg-slate-50 transition-colors shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Filters</span>
            </button>
          </div>
        </div>

        {/* Optional Filter Pills if toggled */}
        {showFilterDropdown && (
          <div className="flex items-center space-x-2 p-3 bg-white border border-slate-200 rounded-2xl shadow-sm text-xs">
            <span className="text-slate-500 font-semibold pl-2">Category:</span>
            {['All', 'Native', 'Compatible'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedFilterCategory(cat)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  selectedFilterCategory === cat
                    ? 'bg-[#007A33] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Species Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSpecies.map((sp) => {
            const isNative = sp.isNative;

            return (
              <div
                key={sp.id}
                className="rounded-3xl bg-white border border-slate-200 overflow-hidden flex flex-col justify-between shadow-sm hover:border-slate-300 transition-all"
              >
                {/* Photo & Badge */}
                <div>
                  <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                    <img
                      src={sp.image}
                      alt={sp.commonName}
                      className="w-full h-full object-cover"
                    />

                    {/* Native / Compatible Badge */}
                    <div className="absolute top-3 left-3">
                      {isNative ? (
                        <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#007A33] text-white flex items-center gap-1 shadow-sm">
                          <Check className="w-3 h-3 text-white" /> Native
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 flex items-center gap-1 shadow-sm">
                          <Compass className="w-3 h-3 text-blue-700" /> Compatible
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-6 space-y-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 font-display">
                        {sp.commonName}
                      </h3>
                      <p className="text-xs italic text-slate-500 font-serif mt-0.5">
                        {sp.botanicalName}
                      </p>
                    </div>

                    {/* Growth & Water Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                          GROWTH RATE
                        </span>
                        <div className="text-base font-extrabold text-[#007A33] font-display mt-0.5">
                          {sp.growthRate}
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                          WATER NEED
                        </span>
                        <div className="text-base font-bold text-slate-800 font-display mt-0.5">
                          {sp.waterNeed || 'Medium'}
                        </div>
                      </div>
                    </div>

                    {/* Description Snippet */}
                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {sp.description}
                    </p>
                  </div>
                </div>

                {/* Find in Stock */}
                <div className="p-6 pt-0">
                  <button
                    onClick={() => handleFindInMukono(sp.id)}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#007A33] hover:bg-[#00662A] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Find in Mukono</span>
                  </button>
                </div>

              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
};
