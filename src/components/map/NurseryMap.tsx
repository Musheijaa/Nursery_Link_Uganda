import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '../../context/AppContext';
import { NurseryDetailModal } from './NurseryDetailModal';
import { 
  Plus, 
  MapPin, 
  Trees, 
  Flame, 
  Sliders, 
  Crosshair, 
  ShieldCheck,
  Check
} from 'lucide-react';

// Custom Marker Icons for Stitch Green + White theme
const createNurseryIcon = (stock: number) => {
  return L.divIcon({
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
};

const createHotspotIcon = (priorityScore: number) => {
  return L.divIcon({
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
};

const createUserLocationIcon = () => {
  return L.divIcon({
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
};

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
    hotspots,
    selectedNursery,
    setSelectedNursery,
    userLocation,
    setUserLocation,
    focusedMapCoords,
    setFocusedMapCoords,
    setActiveTab,
    showToast
  } = useApp();

  const [activeDetailNursery, setActiveDetailNursery] = useState<typeof nurseries[0] | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

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

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] flex flex-col md:flex-row overflow-hidden bg-slate-50">
      
      {/* Left Sidebar Panel - Matches Screenshot 1 */}
      <div className="w-full md:w-[360px] lg:w-[380px] bg-white border-r border-slate-200 flex flex-col justify-between p-6 z-20 overflow-y-auto shrink-0 shadow-xs">
        
        <div className="space-y-6">
          
          {/* Header Title */}
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 font-display tracking-tight">
              Mukono District
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Regional Reforestation Hub
            </p>
          </div>

          {/* Top 2 Metric Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl border border-slate-200 bg-white">
              <span className="text-[11px] text-slate-500 font-semibold block">Active Nurseries</span>
              <div className="text-3xl font-extrabold text-[#007A33] font-display mt-1">
                24
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-white">
              <span className="text-[11px] text-slate-500 font-semibold block">Seedlings Avail.</span>
              <div className="text-3xl font-extrabold text-[#007A33] font-display mt-1">
                120k
              </div>
            </div>
          </div>

          {/* Nurseries Section Header */}
          <div className="flex items-center justify-between pt-2">
            <h2 className="text-base font-bold text-slate-900">Nurseries</h2>
            <button 
              onClick={() => setShowFilterModal(!showFilterModal)}
              className="text-xs font-bold text-[#007A33] hover:underline"
            >
              Filter
            </button>
          </div>

          {/* List of Nursery Cards (Matches Screenshot 1) */}
          <div className="space-y-3">
            {nurseries.map((nursery) => (
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
      <div className="relative flex-1 h-full w-full">
        
        {/* Floating Zoom & Geolocation Controls (Bottom Right - Matches Screenshot 1) */}
        <div className="absolute bottom-6 right-6 z-20 flex flex-col items-center space-y-3">
          
          {/* Zoom Buttons Box */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-1 flex flex-col items-center">
            <button
              onClick={() => {
                const mapEl = document.querySelector('.leaflet-container') as any;
                if (mapEl && mapEl._leaflet_map) mapEl._leaflet_map.zoomIn();
              }}
              className="w-9 h-9 flex items-center justify-center text-slate-700 hover:text-[#007A33] hover:bg-slate-50 rounded-xl font-bold text-lg"
              title="Zoom in"
            >
              +
            </button>
            <div className="w-5 h-[1px] bg-slate-200"></div>
            <button
              onClick={() => {
                const mapEl = document.querySelector('.leaflet-container') as any;
                if (mapEl && mapEl._leaflet_map) mapEl._leaflet_map.zoomOut();
              }}
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
          <Marker position={userLocation} icon={createUserLocationIcon()}>
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
          {nurseries.map((nursery) => (
            <Circle
              key={`buffer-${nursery.id}`}
              center={nursery.coordinates}
              radius={8000}
              pathOptions={{
                color: '#007A33',
                fillColor: '#10B981',
                fillOpacity: 0.14,
                weight: 1.5
              }}
            />
          ))}

          {/* Deforestation Hotspots (Red translucent circles) */}
          {hotspots.map((hotspot) => (
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
              <Marker
                position={hotspot.coordinates}
                icon={createHotspotIcon(hotspot.priorityScore)}
              >
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
          {nurseries.map((nursery) => (
            <Marker
              key={nursery.id}
              position={nursery.coordinates}
              icon={createNurseryIcon(nursery.currentStockTotal)}
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
                  <p className="text-slate-500 text-[11px] mb-2">{nursery.village}, Mukono</p>

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
