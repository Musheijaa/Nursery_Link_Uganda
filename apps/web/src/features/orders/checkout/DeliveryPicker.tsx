import 'leaflet/dist/leaflet.css';
import { nurseryPinSvg, pinSize } from '@nurserylink/ui';
import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import { AttributionControl, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { en } from '../../../copy/en';
import type { LatLng } from '../../../lib/geo';

const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const dropIcon = L.divIcon({
  className: 'nl-pin',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 32 42" aria-hidden="true"><path d="M16 41C16 41 2 25.5 2 16a14 14 0 0 1 28 0c0 9.5-14 25-14 25Z" fill="#b8501f" stroke="#ffffff" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="#ffffff"/></svg>`,
  iconSize: [36, 46],
  iconAnchor: [18, 46],
});

const nurseryIcon = (() => {
  const size = pinSize('normal');
  return L.divIcon({ className: 'nl-pin', html: nurseryPinSvg('normal'), iconSize: [size.width, size.height], iconAnchor: size.anchor });
})();

const PickOnTap = ({ onPick }: { onPick: (p: LatLng) => void }) => {
  useMapEvents({ click: e => { onPick({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) }); } });
  return null;
};

const Follow = ({ point }: { point: LatLng | null }) => {
  const map = useMap();
  useEffect(() => {
    if (point) map.panTo([point.lat, point.lng]);
  }, [point, map]);
  return null;
};

// ~10 m: precise enough for a rider, without pretending to GPS accuracy
const round = (n: number) => Math.round(n * 10_000) / 10_000;

/** Tap the map (or drag the pin) to set where the seedlings should be dropped. */
const DeliveryPicker = ({ point, nursery, onPick, label }: { point: LatLng | null; nursery: LatLng; onPick: (p: LatLng) => void; label: string }) => {
  const center = useMemo(() => point ?? nursery, [point, nursery]);
  return (
    <div role="region" aria-label={label} className="relative isolate h-64 overflow-hidden rounded-md ring-1 ring-line md:h-80">
      <MapContainer center={[center.lat, center.lng]} zoom={14} className="size-full" attributionControl={false}>
        <TileLayer url={TILE_URL} maxZoom={18} crossOrigin />
        <AttributionControl position="bottomright" prefix={false} />
        <PickOnTap onPick={onPick} />
        <Follow point={point} />
        {/* Display only: not focusable (Leaflet would otherwise make it an unnamed button) */}
        <Marker position={[nursery.lat, nursery.lng]} icon={nurseryIcon} interactive={false} keyboard={false} />
        {point && (
          <Marker
            position={[point.lat, point.lng]}
            icon={dropIcon}
            draggable
            keyboard
            // Leaflet gives a keyboard marker role="button"; the title is its accessible name
            title={en.checkout.pinLabel}
            eventHandlers={{
              dragend: e => {
                const ll = (e.target as L.Marker).getLatLng();
                onPick({ lat: round(ll.lat), lng: round(ll.lng) });
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default DeliveryPicker;
