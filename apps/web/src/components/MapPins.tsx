import { nurseryPinSvg } from '@nurserylink/ui';
import { useMap } from '@vis.gl/react-google-maps';
import { useEffect } from 'react';
import type { LatLng } from '../lib/geo';

/** The murram drop point (delivery address): different from every nursery pin */
export const DROP_PIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 32 42" aria-hidden="true"><path d="M16 41C16 41 2 25.5 2 16a14 14 0 0 1 28 0c0 9.5-14 25-14 25Z" fill="#b8501f" stroke="#ffffff" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="#ffffff"/></svg>';

/** Our own SVG (constant strings, never user text) as an advanced marker's content */
export const SvgPin = ({ svg }: { svg: string }) => (
  // A constant SVG from @nurserylink/ui, never user input
  <div style={{ lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: svg }} />
);

export const NurseryPinContent = () => <SvgPin svg={nurseryPinSvg('normal')} />;

/** A dashed line between two points (nursery to drop point) */
export const DashedLine = ({ from, to }: { from: LatLng; to: LatLng }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const line = new google.maps.Polyline({
      map,
      path: [from, to],
      strokeOpacity: 0,
      clickable: false,
      icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: '#1d7647', scale: 3 }, offset: '0', repeat: '14px' }],
    });
    return () => { line.setMap(null); };
  }, [map, from, to]);
  return null;
};

/** Frames points on the map once (with some room around them) */
export const FitPoints = ({ points, maxZoom = 16 }: { points: LatLng[]; maxZoom?: number }) => {
  const map = useMap();
  const key = points.map(p => `${String(p.lat)},${String(p.lng)}`).join('|');
  useEffect(() => {
    if (!map || points.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const p of points) bounds.extend(p);
    map.fitBounds(bounds, 60);
    google.maps.event.addListenerOnce(map, 'idle', () => { if ((map.getZoom() ?? 0) > maxZoom) map.setZoom(maxZoom); });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-frame only when the points change
  }, [map, key, maxZoom]);
  return null;
};
