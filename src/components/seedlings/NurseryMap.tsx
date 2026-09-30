import React, { useEffect } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Nursery, PlantingGaps } from '../../types';

const UGANDA_CENTRE: [number, number] = [1.35, 32.3];

// Built once at module load rather than on every render
const NURSERY_PIN = L.divIcon({
  className: 'map-pin',
  html: '<div class="h-4 w-4 rounded-full border-2 border-white bg-brand-700 shadow"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -10],
});

const SELECTED_PIN = L.divIcon({
  className: 'map-pin',
  html: '<div class="h-6 w-6 rounded-full border-[3px] border-white bg-soil-600 shadow-md"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -14],
});

const BUYER_PIN = L.divIcon({
  className: 'map-pin',
  html: '<div class="h-3.5 w-3.5 rotate-45 border-2 border-white bg-stone-900 shadow"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const FitToNurseries: React.FC<{ nurseries: Nursery[]; selected: Nursery | null }> = ({ nurseries, selected }) => {
  const map = useMap();

  useEffect(() => {
    if (selected) {
      map.flyTo(selected.coordinates, 10, { duration: 0.8 });
    }
  }, [selected, map]);

  const key = nurseries.map(n => n.id).join(',');
  useEffect(() => {
    if (nurseries.length > 0) {
      map.fitBounds(L.latLngBounds(nurseries.map(n => n.coordinates)), { padding: [40, 40], maxZoom: 10 });
    }
    // Refit only when the set of visible nurseries changes, not on every render
  }, [key, map]);

  return null;
};

interface NurseryMapProps {
  nurseries: Nursery[];
  selected: Nursery | null;
  buyerLocation: { name: string; coordinates: [number, number] };
  forestAreas: PlantingGaps['areas'];
  onSelect: (nursery: Nursery) => void;
  onOpen: (nursery: Nursery) => void;
}

export const NurseryMap: React.FC<NurseryMapProps> = ({ nurseries, selected, buyerLocation, forestAreas, onSelect, onOpen }) => (
  <MapContainer center={UGANDA_CENTRE} zoom={7} scrollWheelZoom className="h-full w-full">
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      maxZoom={19}
    />
    <FitToNurseries nurseries={nurseries} selected={selected} />

    {forestAreas.map(area => (
      <Circle
        key={area.id}
        center={area.coordinates}
        radius={area.radiusKm * 1000}
        pathOptions={{ color: '#a94726', fillColor: '#c75b30', fillOpacity: 0.15, weight: 1 }}
      >
        <Popup>
          <strong>{area.name}</strong>
          <br />
          {area.district} District · {area.drivers[0]}
        </Popup>
      </Circle>
    ))}

    <Marker position={buyerLocation.coordinates} icon={BUYER_PIN}>
      <Popup>Your planting area: {buyerLocation.name}</Popup>
    </Marker>

    {nurseries.map(nursery => (
      <Marker
        key={nursery.id}
        position={nursery.coordinates}
        icon={selected?.id === nursery.id ? SELECTED_PIN : NURSERY_PIN}
        eventHandlers={{ click: () => onSelect(nursery) }}
      >
        <Popup>
          <div className="space-y-1">
            <strong className="block">{nursery.name}</strong>
            <span className="block text-stone-600">{nursery.subCounty}, {nursery.district}</span>
            <button onClick={() => onOpen(nursery)} className="font-semibold text-brand-700 hover:underline">
              View seedlings →
            </button>
          </div>
        </Popup>
      </Marker>
    ))}
  </MapContainer>
);
