import { MarkerClusterer, SuperClusterAlgorithm } from '@googlemaps/markerclusterer';
import { MAP_PIN_SCALE, clusterPinSvg, cn, formatDistance, nurseryPinSvg, pinLabel } from '@nurserylink/ui';
import { Map as GoogleMap, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import type { Feature as GeoFeature } from 'geojson';
import { LocateFixed } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { en } from '../../copy/en';
import type { LatLng } from '../../lib/geo';
import { GOOGLE_MAP_ID, MapUnavailable, MapsProvider, UGANDA_BOUNDS, mapsAvailable } from '../../lib/googleMaps';
import { useOnline } from '../../lib/online';
import { toLatLng, type NurseryFeature, type NurseryProps } from './api';

/** Pins cluster up to this zoom; with a district or sub-county chosen they cluster less. */
const CLUSTER_UNTIL = 13;
const CLUSTER_RADIUS = 60;
const CLUSTER_RADIUS_IN_AREA = 30;

const CANOPY = '#1b6e44';
const FOREST = '#1d7647';

type PinData = { id: string; name: string; gift: boolean; certified: boolean; km: number | null; approx: boolean };

const pinData = (p: NurseryProps): PinData => ({
  id: p.id,
  name: p.name,
  gift: p.has_active_campaign,
  certified: p.certified,
  km: p.road_km ?? p.straight_km ?? null,
  approx: p.road_km === undefined || p.road_km === null,
});

/** An SVG string as an element for an advanced marker's content */
const svgElement = (svg: string): HTMLElement => {
  const el = document.createElement('div');
  el.innerHTML = svg;
  el.style.lineHeight = '0';
  return el;
};

const pinContent = (d: PinData, selected: boolean) => svgElement(nurseryPinSvg(d.gift ? 'gift' : 'normal', selected, MAP_PIN_SCALE, d.certified));
const pinTitle = (d: PinData, selected: boolean) =>
  pinLabel(d.name, { distance: d.km !== null ? formatDistance(d.km, d.approx ? 'straight_line' : 'road') : undefined, gift: d.gift, certified: d.certified, selected });

/**
 * The nursery pins (normal, giveaway pickup, certified, selected), clustered. Markers are made once per
 * set of nurseries; choosing a nursery only redraws the two pins whose look changes.
 */
const Pins = ({ features, selectedId, onSelect, areaChosen }: { features: NurseryFeature[]; selectedId: string | null; onSelect: (id: string) => void; areaChosen: boolean }) => {
  const map = useMap();
  const markerLib = useMapsLibrary('marker');
  const markers = useRef(new Map<string, { marker: google.maps.marker.AdvancedMarkerElement; data: PinData }>());
  const gift = useRef(new WeakMap<google.maps.marker.AdvancedMarkerElement, boolean>());
  const clusterer = useRef<MarkerClusterer | null>(null);
  const shownSelected = useRef<string | null>(null);
  const select = useRef(onSelect);
  useEffect(() => { select.current = onSelect; }, [onSelect]);

  // The clusterer: Forest discs with the count, a Sun badge when a giveaway pickup point is inside
  useEffect(() => {
    if (!map || !markerLib) return;
    const c = new MarkerClusterer({
      map,
      algorithm: new SuperClusterAlgorithm({ radius: areaChosen ? CLUSTER_RADIUS_IN_AREA : CLUSTER_RADIUS, maxZoom: CLUSTER_UNTIL }),
      renderer: {
        render: ({ count, position, markers: inside }) => {
          const hasGift = inside.some(m => gift.current.get(m as google.maps.marker.AdvancedMarkerElement) === true);
          return new markerLib.AdvancedMarkerElement({
            position,
            content: svgElement(clusterPinSvg(count, hasGift)),
            title: en.nurseries.clusterLabel(count, hasGift),
            zIndex: 1000 + count,
          });
        },
      },
    });
    clusterer.current = c;
    return () => {
      c.clearMarkers();
      c.setMap(null);
      clusterer.current = null;
    };
  }, [map, markerLib, areaChosen]);

  // One marker per nursery, rebuilt when the set of nurseries changes
  useEffect(() => {
    const c = clusterer.current;
    if (!markerLib || !c) return;
    for (const { marker } of markers.current.values()) marker.map = null;
    markers.current.clear();
    const made = features.map(f => {
      const data = pinData(f.properties);
      const selected = data.id === shownSelected.current;
      const [lat, lng] = toLatLng(f.geometry.coordinates);
      const marker = new markerLib.AdvancedMarkerElement({
        position: { lat, lng },
        content: pinContent(data, selected),
        title: pinTitle(data, selected),
        gmpClickable: true,
        zIndex: selected ? 3000 : data.gift ? 500 : 0,
      });
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- the stable-channel API; 'gmp-click' isn't in every channel yet
      marker.addListener('click', () => { select.current(data.id); });
      gift.current.set(marker, data.gift);
      markers.current.set(data.id, { marker, data });
      return marker;
    });
    c.clearMarkers();
    c.addMarkers(made);
  }, [features, markerLib, areaChosen]);

  // The selected pin is raised and ringed; the previous one goes back to normal
  useEffect(() => {
    const restyle = (id: string | null, selected: boolean) => {
      const entry = id ? markers.current.get(id) : undefined;
      if (!entry) return;
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- the stable-channel API for a marker's look
      entry.marker.content = pinContent(entry.data, selected);
      entry.marker.title = pinTitle(entry.data, selected);
      entry.marker.zIndex = selected ? 3000 : entry.data.gift ? 500 : 0;
    };
    if (shownSelected.current === selectedId) return;
    restyle(shownSelected.current, false);
    restyle(selectedId, true);
    shownSelected.current = selectedId;
  }, [selectedId, features]);

  return null;
};

/** The filter's district or sub-county: outlined and lightly filled, and the map moves to it. */
const SelectedBoundary = ({ shape, compact }: { shape: GeoFeature | null; compact: boolean }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || !shape) return;
    const layer = new google.maps.Data({ map });
    layer.addGeoJson(shape);
    layer.setStyle({ strokeColor: FOREST, strokeWeight: 3, fillColor: FOREST, fillOpacity: 0.07, clickable: false });
    const bounds = new google.maps.LatLngBounds();
    layer.forEach(f => { f.getGeometry()?.forEachLatLng(ll => { bounds.extend(ll); }); });
    // Phones: keep the area clear of the floating search box and the list sheet
    const height = map.getDiv().clientHeight;
    map.fitBounds(bounds, compact ? { top: 120, left: 16, right: 16, bottom: Math.round(height * 0.45) } : 24);
    return () => { layer.setMap(null); };
  }, [map, shape, compact]);
  return null;
};

/**
 * Fits the view to the nurseries the first time they arrive, and after the filters change. When a
 * district or sub-county is chosen, the map goes to that area instead (SelectedBoundary).
 */
const FitToData = ({ features, fitKey, areaChosen }: { features: NurseryFeature[]; fitKey: string; areaChosen: boolean }) => {
  const map = useMap();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!map || features.length === 0 || last.current === fitKey) return;
    last.current = fitKey;
    if (areaChosen) return;
    const bounds = new google.maps.LatLngBounds();
    for (const f of features) {
      const [lat, lng] = toLatLng(f.geometry.coordinates);
      bounds.extend({ lat, lng });
    }
    map.fitBounds(bounds, 40);
    // Not closer than street level for a single nursery
    google.maps.event.addListenerOnce(map, 'idle', () => { if ((map.getZoom() ?? 0) > 13) map.setZoom(13); });
  }, [features, fitKey, map, areaChosen]);
  return null;
};

const positionKey = (p: LatLng | null) => (p ? `${String(p.lat)},${String(p.lng)}` : null);

/**
 * Where the user is: a green dot. The map goes there when they share their location or pick a place;
 * a location remembered from earlier in the session doesn't move the map on arrival.
 */
const UserLocation = ({ position }: { position: LatLng | null }) => {
  const map = useMap();
  const markerLib = useMapsLibrary('marker');
  const last = useRef<string | null>(positionKey(position));
  useEffect(() => {
    if (!map || !markerLib || !position) return;
    const dot = document.createElement('div');
    dot.setAttribute('aria-hidden', 'true');
    dot.style.cssText = `width:16px;height:16px;border-radius:9999px;background:${CANOPY};border:3px solid #fff;box-shadow:0 0 0 1px ${CANOPY}`;
    const marker = new markerLib.AdvancedMarkerElement({ map, position, content: dot, zIndex: 4000 });
    return () => { marker.map = null; };
  }, [map, markerLib, position]);
  useEffect(() => {
    const key = positionKey(position);
    if (!map || !position || last.current === key) return;
    last.current = key;
    map.panTo(position);
    if ((map.getZoom() ?? 0) < 12) map.setZoom(12);
  }, [position, map]);
  return null;
};

/** Keeps the selected nursery in view. */
const FollowSelected = ({ features, selectedId }: { features: NurseryFeature[]; selectedId: string | null }) => {
  const map = useMap();
  useEffect(() => {
    const f = features.find(x => x.id === selectedId);
    if (!map || !f) return;
    const [lat, lng] = toLatLng(f.geometry.coordinates);
    if (!map.getBounds()?.contains({ lat, lng })) map.panTo({ lat, lng });
  }, [selectedId, features, map]);
  return null;
};

export interface NurseryMapProps {
  features: NurseryFeature[];
  fitKey: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  boundary: GeoFeature | null;
  /** A district or sub-county filter is set (its outline may still be loading) */
  areaChosen: boolean;
  position: LatLng | null;
  onLocate: () => void;
  /** Phones: no zoom buttons under the floating search; the locate button sits below it */
  compact?: boolean;
  className?: string;
}

/**
 * The nursery map on Google Maps (brief §2). Loaded only on /nurseries. Without an API key, or offline
 * (Google's tiles may not be cached), it gives way to a note: the list shows the same nurseries.
 */
const NurseryMap = ({ features, fitKey, selectedId, onSelect, boundary, areaChosen, position, onLocate, compact = false, className }: NurseryMapProps) => {
  const online = useOnline();
  if (!mapsAvailable || !online) return <MapUnavailable reason={online ? 'no_key' : 'offline'} className={className} />;
  return (
    <MapsProvider>
      <div role="region" aria-label={en.nurseries.mapLabel} className={className}>
        <GoogleMap
          mapId={GOOGLE_MAP_ID}
          defaultBounds={UGANDA_BOUNDS}
          className="size-full"
          gestureHandling="greedy"
          disableDefaultUI={compact}
          zoomControl={!compact}
          streetViewControl={false}
          mapTypeControl={false}
          fullscreenControl={false}
          clickableIcons={false}
          minZoom={6}
          reuseMaps
        >
          <FitToData features={features} fitKey={fitKey} areaChosen={areaChosen} />
          <SelectedBoundary shape={boundary} compact={compact} />
          <FollowSelected features={features} selectedId={selectedId} />
          <UserLocation position={position} />
          <Pins features={features} selectedId={selectedId} onSelect={onSelect} areaChosen={areaChosen} />
        </GoogleMap>
        <button
          type="button"
          onClick={onLocate}
          aria-label={en.nurseries.locateMe}
          className={cn('absolute right-3 z-10 flex size-11 items-center justify-center rounded-sm bg-paper text-forest shadow-float ring-1 ring-line', compact ? 'top-[7.25rem]' : 'bottom-24')}
        >
          <LocateFixed aria-hidden className="size-5" />
        </button>
      </div>
    </MapsProvider>
  );
};

export default NurseryMap;
