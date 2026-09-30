import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '../../context/AppContext';
import { Nursery } from '../../types';
import { NurseryDetailModal } from './NurseryDetailModal';
import {
  Plus,
  MapPin,
  Crosshair,
  Check,
  X
} from 'lucide-react';

// Sentinel values shared with the defaults in AppContext
const ALL_DISTRICTS = 'All Districts';
const ALL_CATEGORIES = 'All Categories';
const ALL_CERTIFICATIONS = 'All Certifications';
const SERVICE_RADII_KM = [5, 10, 20];

const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

// Marker icons are built once at module load rather than on every render
const NURSERY_ICON = L.divIcon({
  className: 'custom-nursery-pin',
  html: `
    <div class="relative flex items-center justify-center cursor-pointer">
      <div class="w-8 h-8 rounded-full bg-[#007A33] border-2 border-white shadow-md flex items-center justify-center text-white">
        <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22v-7"/><path d="M12 2a5 5 0 0 0-5 5c0 1.5.6 2.8 1.5 3.8C6.6 12 5 14 5 16.5A5.5 5.5 0 0 0 10.5 22h3a5.5 5.5 0 0 0 5.5-5.5c0-2.5-1.6-4.5-3.5-5.7.9-1 1.5-2.3 1.5-3.8a5 5 0 0 0-5-5z"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -18]
});

const HOTSPOT_ICON = L.divIcon({
  className: 'custom-hotspot-pin',
  html: `
    <div class="relative flex items-center justify-center cursor-pointer">
      <div class="w-7 h-7 rounded-full bg-red-600 border-2 border-white shadow-md flex items-center justify-center text-white">
        <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16]
});

const USER_LOCATION_ICON = L.divIcon({
  className: 'custom-user-pin',
  html: `
    <div class="relative flex items-center justify-center">
      <div class="w-7 h-7 rounded-full bg-[#007A33] border-2 border-white shadow-md flex items-center justify-center text-white">
        <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="5"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14]
});

// Map controller helper to fly to target coordinates
const MapFlyTo: React.FC<{ coords: [number, number] | null }> = ({ coords }) => {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.flyTo(coords, 11.5, { duration: 1.2 });
    }
  }, [coords, map]);
  return null;
};

// Map click handler to update planting site location
const MapClickHandler: React.FC<{ onLocationSelect: (latlng: [number, number]) => void }> = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      onLocationSelect([e.latlng.lat, e.latlng.lng]);
    }
  });
  return null;
};

export const NurseryMap: React.FC = () => {
  const {
    nurseries,
    species,
    hotspots,
    selectedNursery,
    setSelectedNursery,
    targetSpeciesFilter,
    setTargetSpeciesFilter,
    selectedDistrict,
    setSelectedDistrict,
    selectedCategory,
    setSelectedCategory,
    selectedCertification,
    setSelectedCertification,
    serviceRadiusKm,
    setServiceRadiusKm,
    showDeforestationLayer,
    setShowDeforestationLayer,
    showServiceZones,
    setShowServiceZones,
    userLocation,
    setUserLocation,
    focusedMapCoords,
    setFocusedMapCoords,
    setActiveTab,
    showToast
  } = useApp();

  const [map, setMap] = useState<L.Map | null>(null);
  const [activeDetailNursery, setActiveDetailNursery] = useState<Nursery | null>(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const districtOptions = useMemo(
    () => Array.from(new Set(nurseries.map(n => n.district))).sort(),
    [nurseries]
  );
  const categoryOptions = useMemo(
    () => Array.from(new Set(nurseries.flatMap(n => n.batches.map(b => b.category)))).sort(),
    [nurseries]
  );
  const certificationOptions = useMemo(
    () => Array.from(new Set(nurseries.map(n => n.certification))).sort(),
    [nurseries]
  );

  const batchMatchesFilters = (batch: Nursery['batches'][number]) =>
    batch.quantityAvailable > 0 &&
    (selectedCategory === ALL_CATEGORIES || batch.category === selectedCategory) &&
    (!targetSpeciesFilter || batch.speciesId === targetSpeciesFilter);

  const filteredNurseries = nurseries.filter(n =>
    (selectedDistrict === ALL_DISTRICTS || n.district === selectedDistrict) &&
    (selectedCertification === ALL_CERTIFICATIONS || n.certification === selectedCertification) &&
    n.batches.some(batchMatchesFilters)
  );

  // Only count stock from batches that match the active species/category filters
  const matchingStockTotal = filteredNurseries.reduce(
    (sum, n) => sum + n.batches.filter(batchMatchesFilters).reduce((s, b) => s + b.quantityAvailable, 0),
    0
  );

  const targetSpecies = species.find(s => s.id === targetSpeciesFilter);
  const hasActiveFilters =
    selectedDistrict !== ALL_DISTRICTS ||
    selectedCategory !== ALL_CATEGORIES ||
    selectedCertification !== ALL_CERTIFICATIONS ||
    targetSpeciesFilter !== null;

  const resetFilters = () => {
    setSelectedDistrict(ALL_DISTRICTS);
    setSelectedCategory(ALL_CATEGORIES);
    setSelectedCertification(ALL_CERTIFICATIONS);
    setTargetSpeciesFilter(null);
  };

  const handleLocateUser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setUserLocation(coords);
          setFocusedMapCoords(coords);
          showToast('Planting site updated to your current location!');
        },
        () => {
          showToast('Click anywhere on the map to set your planting site.');
        }
      );
    }
  };

  const selectClassName = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#007A33]';

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] flex flex-col md:flex-row overflow-hidden bg-slate-50">

      {/* Left Sidebar Panel */}
      <div className="w-full md:w-[360px] lg:w-[380px] bg-white border-r border-slate-200 flex flex-col justify-between p-6 z-20 overflow-y-auto shrink-0 shadow-sm">

        <div className="space-y-6">

          {/* Header Title */}
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 font-display tracking-tight">
              {selectedDistrict === ALL_DISTRICTS ? 'All Districts' : `${selectedDistrict} District`}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Regional Reforestation Hub
            </p>
          </div>

          {/* Top 2 Metric Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl border border-slate-200 bg-white">
              <span className="text-[11px] text-slate-500 font-semibold block">Matching Nurseries</span>
              <div className="text-3xl font-extrabold text-[#007A33] font-display mt-1">
                {filteredNurseries.length}
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-white">
              <span className="text-[11px] text-slate-500 font-semibold block">Seedlings Avail.</span>
              <div className="text-3xl font-extrabold text-[#007A33] font-display mt-1">
                {compactNumber.format(matchingStockTotal)}
              </div>
            </div>
          </div>

          {/* Nurseries Section Header */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Nurseries</h2>
              <div className="flex items-center gap-3">
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={() => setShowFilterPanel(!showFilterPanel)}
                  className="text-xs font-bold text-[#007A33] hover:underline"
                >
                  {showFilterPanel ? 'Hide filters' : 'Filter'}
                </button>
              </div>
            </div>

            {/* Active species filter chip (set from the Tree Library) */}
            {targetSpecies && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-[#007A33]">
                Stocking: {targetSpecies.commonName}
                <button onClick={() => setTargetSpeciesFilter(null)} title="Clear species filter">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Filter Panel */}
            {showFilterPanel && (
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">District</label>
                  <select value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)} className={selectClassName}>
                    <option value={ALL_DISTRICTS}>{ALL_DISTRICTS}</option>
                    {districtOptions.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Species in stock</label>
                  <select
                    value={targetSpeciesFilter ?? ''}
                    onChange={(e) => setTargetSpeciesFilter(e.target.value || null)}
                    className={selectClassName}
                  >
                    <option value="">Any species</option>
                    {species.map(s => <option key={s.id} value={s.id}>{s.commonName}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Category</label>
                  <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className={selectClassName}>
                    <option value={ALL_CATEGORIES}>{ALL_CATEGORIES}</option>
                    {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Certification</label>
                  <select value={selectedCertification} onChange={(e) => setSelectedCertification(e.target.value)} className={selectClassName}>
                    <option value={ALL_CERTIFICATIONS}>{ALL_CERTIFICATIONS}</option>
                    {certificationOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Service radius</label>
                  <div className="grid grid-cols-3 gap-2">
                    {SERVICE_RADII_KM.map(km => (
                      <button
                        key={km}
                        onClick={() => setServiceRadiusKm(km)}
                        className={`py-1.5 rounded-xl font-bold transition-colors ${
                          serviceRadiusKm === km
                            ? 'bg-[#007A33] text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {km} km
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showServiceZones}
                      onChange={(e) => setShowServiceZones(e.target.checked)}
                      className="accent-[#007A33]"
                    />
                    Show service zones
                  </label>
                  <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showDeforestationLayer}
                      onChange={(e) => setShowDeforestationLayer(e.target.checked)}
                      className="accent-red-600"
                    />
                    Show deforestation hotspots
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* List of Nursery Cards */}
          <div className="space-y-3">
            {filteredNurseries.length === 0 && (
              <div className="p-6 rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-500 space-y-2">
                <p className="font-semibold">No nurseries match these filters.</p>
                <button onClick={resetFilters} className="font-bold text-[#007A33] hover:underline">
                  Reset filters
                </button>
              </div>
            )}

            {filteredNurseries.map((nursery) => (
              <div
                key={nursery.id}
                onClick={() => {
                  setSelectedNursery(nursery);
                  setFocusedMapCoords(nursery.coordinates);
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer bg-white ${
                  selectedNursery?.id === nursery.id
                    ? 'border-[#007A33] shadow-sm ring-1 ring-[#007A33]'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-slate-900 text-sm">{nursery.name}</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#007A33] border border-emerald-200 flex items-center gap-0.5">
                    <Check className="w-3 h-3 text-[#007A33]" /> Verified
                  </span>
                </div>

                <div className="flex items-center gap-1 text-xs text-slate-500 mt-1 font-medium">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>{nursery.zone || `${nursery.subCounty} Sector`}</span>
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100">
                  <span className="text-xs font-semibold text-slate-800 font-mono">
                    {nursery.currentStockTotal.toLocaleString()} Seedlings
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDetailNursery(nursery);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-[#007A33] text-xs font-bold transition-colors"
                  >
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Bottom + Add New Batch Button */}
        <div className="pt-6">
          <button
            onClick={() => setActiveTab('dashboard')}
            className="w-full py-3 px-4 rounded-xl bg-[#007A33] hover:bg-[#00662A] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Batch</span>
          </button>
        </div>

      </div>

      {/* Right Map Canvas */}
      {/* `isolate` keeps Leaflet's high z-index panes from painting over app modals */}
      <div className="relative isolate flex-1 h-full w-full">

        {/* Floating Zoom & Geolocation Controls */}
        <div className="absolute bottom-6 right-6 z-[1000] flex flex-col items-center space-y-3">

          {/* Zoom Buttons Box */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-1 flex flex-col items-center">
            <button
              onClick={() => map?.zoomIn()}
              className="w-9 h-9 flex items-center justify-center text-slate-700 hover:text-[#007A33] hover:bg-slate-50 rounded-xl font-bold text-lg"
              title="Zoom in"
            >
              +
            </button>
            <div className="w-5 h-[1px] bg-slate-200"></div>
            <button
              onClick={() => map?.zoomOut()}
              className="w-9 h-9 flex items-center justify-center text-slate-700 hover:text-[#007A33] hover:bg-slate-50 rounded-xl font-bold text-lg"
              title="Zoom out"
            >
              −
            </button>
          </div>

          {/* Locate Me Circle Button */}
          <button
            onClick={handleLocateUser}
            className="w-11 h-11 rounded-full bg-[#007A33] hover:bg-[#00662A] text-white flex items-center justify-center shadow-md transition-transform hover:scale-105"
            title="Locate planting site"
          >
            <Crosshair className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Leaflet Map Engine */}
        <MapContainer
          ref={setMap}
          center={[0.3542, 32.7538]}
          zoom={11}
          zoomControl={false}
          scrollWheelZoom={true}
          className="w-full h-full"
        >
          {/* Clean Light Tile Layer */}
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          <MapFlyTo coords={focusedMapCoords} />
          <MapClickHandler onLocationSelect={(coords) => {
            setUserLocation(coords);
            showToast('Planting site updated in Mukono!');
          }} />

          {/* User Planting Site Marker */}
          <Marker position={userLocation} icon={USER_LOCATION_ICON}>
            <Popup>
              <div className="p-3 text-xs bg-white text-slate-900 rounded-lg font-sans">
                <span className="font-bold text-[#007A33] block mb-1">📍 Selected Planting Site</span>
                <p className="text-slate-500 font-mono text-[11px]">
                  Mukono [{userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}]
                </p>
              </div>
            </Popup>
          </Marker>

          {/* Service Radius Buffers (Green translucent circles) */}
          {showServiceZones && filteredNurseries.map((nursery) => (
            <Circle
              key={`buffer-${nursery.id}`}
              center={nursery.coordinates}
              radius={serviceRadiusKm * 1000}
              pathOptions={{
                color: '#007A33',
                fillColor: '#10B981',
                fillOpacity: 0.14,
                weight: 1.5
              }}
            />
          ))}

          {/* Deforestation Hotspots (Red translucent circles) */}
          {showDeforestationLayer && hotspots.map((hotspot) => (
            <React.Fragment key={hotspot.id}>
              <Circle
                center={hotspot.coordinates}
                radius={hotspot.radiusKm * 1000}
                pathOptions={{
                  color: '#DC2626',
                  fillColor: '#EF4444',
                  fillOpacity: 0.18,
                  weight: 1.5
                }}
              />
              <Marker position={hotspot.coordinates} icon={HOTSPOT_ICON}>
                <Popup>
                  <div className="p-3 text-xs bg-white text-slate-900 rounded-xl min-w-[200px] font-sans">
                    <span className="font-bold text-red-600 block mb-1">{hotspot.name}</span>
                    <p className="text-slate-500 text-[11px] mb-2">{hotspot.district}</p>
                    <div className="text-[11px] text-slate-700">
                      Forest Loss: <strong className="text-red-600">{hotspot.forestLossHectaresPast3Yrs.toLocaleString()} ha</strong>
                    </div>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          ))}

          {/* Nursery Markers */}
          {filteredNurseries.map((nursery) => (
            <Marker
              key={nursery.id}
              position={nursery.coordinates}
              icon={NURSERY_ICON}
              eventHandlers={{
                click: () => {
                  setSelectedNursery(nursery);
                }
              }}
            >
              <Popup>
                <div className="p-3 text-xs bg-white text-slate-900 rounded-xl min-w-[220px] font-sans">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#007A33]">
                      {nursery.zone}
                    </span>
                    <span className="text-slate-600 font-bold">⭐ {nursery.rating}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mt-1">{nursery.name}</h3>
                  <p className="text-slate-500 text-[11px] mb-2">{nursery.village}, {nursery.district}</p>

                  <button
                    onClick={() => setActiveDetailNursery(nursery)}
                    className="w-full py-1.5 rounded-xl bg-[#007A33] hover:bg-[#00662A] text-white font-bold text-xs"
                  >
                    View Stock & Buy
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

        </MapContainer>
      </div>

      {/* Nursery Detail Modal when clicked */}
      {activeDetailNursery && (
        <NurseryDetailModal
          nursery={activeDetailNursery}
          onClose={() => setActiveDetailNursery(null)}
        />
      )}

    </div>
  );
};
