import { AdvancedMarker, Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import { useEffect } from 'react';
import { DROP_PIN_SVG, NurseryPinContent, SvgPin } from '../../../components/MapPins';
import { en } from '../../../copy/en';
import type { LatLng } from '../../../lib/geo';
import { GOOGLE_MAP_ID, MapUnavailable, MapsProvider, mapsAvailable } from '../../../lib/googleMaps';

// ~10 m: precise enough for a rider, without pretending to GPS accuracy
const round = (n: number) => Math.round(n * 10_000) / 10_000;

const Follow = ({ point }: { point: LatLng | null }) => {
  const map = useMap();
  useEffect(() => {
    if (map && point) map.panTo(point);
  }, [point, map]);
  return null;
};

/** Tap the map (or drag the pin) to set where the seedlings should be dropped. */
const DeliveryPicker = ({ point, nursery, onPick, label }: { point: LatLng | null; nursery: LatLng; onPick: (p: LatLng) => void; label: string }) => {
  const box = 'relative isolate h-64 overflow-hidden rounded-md ring-1 ring-line md:h-80';
  if (!mapsAvailable) return <MapUnavailable reason="no_key" className={box} />;
  return (
    <MapsProvider>
      <div role="region" aria-label={label} className={box}>
        <GoogleMap
          mapId={GOOGLE_MAP_ID}
          defaultCenter={point ?? nursery}
          defaultZoom={14}
          className="size-full"
          gestureHandling="greedy"
          streetViewControl={false}
          mapTypeControl={false}
          fullscreenControl={false}
          clickableIcons={false}
          onClick={e => {
            const ll = e.detail.latLng;
            if (ll) onPick({ lat: round(ll.lat), lng: round(ll.lng) });
          }}
        >
          <Follow point={point} />
          <AdvancedMarker position={nursery}><NurseryPinContent /></AdvancedMarker>
          {point && (
            <AdvancedMarker
              position={point}
              draggable
              title={en.checkout.pinLabel}
              onDragEnd={e => {
                const ll = e.latLng;
                if (ll) onPick({ lat: round(ll.lat()), lng: round(ll.lng()) });
              }}
            >
              <SvgPin svg={DROP_PIN_SVG} />
            </AdvancedMarker>
          )}
        </GoogleMap>
      </div>
    </MapsProvider>
  );
};

export default DeliveryPicker;
