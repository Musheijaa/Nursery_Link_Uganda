import { nurseryPinSvg } from '@nurserylink/ui';
import { APIProvider, AdvancedMarker, Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import type { Feature } from 'geojson';
import { MapPinOff } from 'lucide-react';
import { useEffect } from 'react';
import { en } from '../../copy/en';

/** Google Maps key and Map ID (set at build time; never committed) */
const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
const UGANDA = { north: 4.3, south: -1.5, west: 29.5, east: 35.1 };
const FOREST = '#1d7647';

export interface Point {
  lat: number;
  lng: number;
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** The chosen district or sub-county, outlined, and the map moves to it; a point out of view is brought in. */
const Follow = ({ point, boundary }: { point: Point | null; boundary: Feature | null }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || !boundary) return;
    const layer = new google.maps.Data({ map });
    layer.addGeoJson(boundary);
    layer.setStyle({ strokeColor: FOREST, strokeWeight: 2, fillColor: FOREST, fillOpacity: 0.05, clickable: false });
    const bounds = new google.maps.LatLngBounds();
    layer.forEach(f => { f.getGeometry()?.forEachLatLng(ll => { bounds.extend(ll); }); });
    map.fitBounds(bounds, 16);
    return () => { layer.setMap(null); };
  }, [boundary, map]);
  useEffect(() => {
    if (!map || !point || map.getBounds()?.contains(point)) return;
    map.panTo(point);
    if ((map.getZoom() ?? 0) < 13) map.setZoom(13);
  }, [point, map]);
  return null;
};

/** Click the map to place the nursery (or drag the pin), on Google Maps (brief §2 and §10.5). */
const PointPicker = ({ point, onPick, boundary, label }: { point: Point | null; onPick: (p: Point) => void; boundary: Feature | null; label: string }) => {
  if (!KEY) {
    return (
      <div role="note" className="flex h-80 flex-col items-center justify-center gap-2 rounded-md bg-sand p-4 text-center ring-1 ring-line">
        <MapPinOff aria-hidden className="size-6 text-bark-muted" />
        <p className="max-w-sm text-sm">{en.nurseries.mapUnavailable}</p>
      </div>
    );
  }
  return (
    <APIProvider apiKey={KEY} libraries={['marker']} language="en" region="UG">
      <div role="region" aria-label={label} className="relative isolate h-80 overflow-hidden rounded-md ring-1 ring-line">
        <GoogleMap
          mapId={MAP_ID}
          {...(point ? { defaultCenter: point, defaultZoom: 14 } : { defaultBounds: UGANDA })}
          className="size-full"
          gestureHandling="greedy"
          streetViewControl={false}
          fullscreenControl={false}
          clickableIcons={false}
          onClick={e => {
            const ll = e.detail.latLng;
            if (ll) onPick({ lat: round(ll.lat), lng: round(ll.lng) });
          }}
        >
          <Follow point={point} boundary={boundary} />
          {point && (
            <AdvancedMarker
              position={point}
              draggable
              title={en.nurseries.nurseryPin}
              onDragEnd={e => {
                const ll = e.latLng;
                if (ll) onPick({ lat: round(ll.lat()), lng: round(ll.lng()) });
              }}
            >
              {/* A constant SVG from @nurserylink/ui, no user input */}
              <div style={{ lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: nurseryPinSvg('normal', true) }} />
            </AdvancedMarker>
          )}
        </GoogleMap>
      </div>
    </APIProvider>
  );
};
export default PointPicker;
