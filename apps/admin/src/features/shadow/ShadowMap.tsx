import 'leaflet/dist/leaflet.css';
import { nurseryPinSvg, pinSize } from '@nurserylink/ui';
import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import { GeoJSON, MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { Feature, FeatureCollection, MultiPolygon } from 'geojson';
import { en } from '../../copy/en';
import type { LayerCollection } from './api';
import { colours, lossOpacity } from './style';

const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const MUKONO: L.LatLngBoundsExpression = [[0.0, 32.6], [0.73, 33.0]];

export type MapLayer = 'cells' | 'shadows' | 'zones' | 'nurseries';
export interface MapNursery { id: string; name: string; lat: number; lng: number }

type CellProps = { loss_pct: number; in_shadow: boolean };
type ShadowProps = { id: number; loss_pct: number; area_km2: number; district: string | null };
type ZoneProps = { nursery_id: string; nursery_name: string; km: number };

const pin = (() => {
  const size = pinSize('normal', false);
  return L.divIcon({ className: 'nl-pin', html: nurseryPinSvg('normal', false), iconSize: [size.width * 0.75, size.height * 0.75], iconAnchor: [size.anchor[0] * 0.75, size.anchor[1] * 0.75] });
})();

const asCollection = <P,>(c: LayerCollection) => c as unknown as FeatureCollection<MultiPolygon, P>;
const pctText = (n: number) => n.toLocaleString('en-UG', { maximumFractionDigits: 1 });

const KeepSized = () => {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => { map.invalidateSize(); });
    observer.observe(map.getContainer());
    return () => { observer.disconnect(); };
  }, [map]);
  return null;
};

/** Fits the map to the shadows (or, with none, the loss squares) of a newly opened run, and to a zone chosen in the table. */
const Fit = ({ target }: { target: L.LatLngBounds | null }) => {
  const map = useMap();
  useEffect(() => {
    if (target?.isValid()) map.flyToBounds(target, { padding: [24, 24], maxZoom: 13, duration: 0.6 });
  }, [map, target]);
  return null;
};

const ShadowMap = ({ runKey, threshold, cells, shadows, zones, nurseries, visible, selected, onSelect }: {
  runKey: string;
  threshold: number;
  cells: LayerCollection | undefined;
  shadows: LayerCollection | undefined;
  zones: LayerCollection | undefined;
  nurseries: MapNursery[];
  visible: Set<MapLayer>;
  selected: number | null;
  onSelect: (id: number) => void;
}) => {
  const c = colours();
  const renderer = useMemo(() => L.canvas({ padding: 0.5 }), []);
  const target = useMemo(() => {
    if (selected !== null && shadows) {
      const f = asCollection<ShadowProps>(shadows).features.find(x => x.properties.id === selected);
      if (f) return L.geoJSON(f).getBounds();
    }
    const base = shadows?.features.length ? shadows : cells;
    return base?.features.length ? L.geoJSON(asCollection(base)).getBounds() : null;
  }, [selected, shadows, cells]);

  return (
    <div role="region" aria-label={en.shadow.mapLabel} className="relative isolate h-[28rem] overflow-hidden rounded-md ring-1 ring-line lg:h-[36rem]">
      <MapContainer bounds={MUKONO} className="size-full" preferCanvas>
        <TileLayer url={TILE_URL} maxZoom={18} crossOrigin attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
        <KeepSized />
        <Fit target={target} />
        {visible.has('zones') && zones && (
          <GeoJSON
            key={`zones-${runKey}`}
            data={asCollection<ZoneProps>(zones)}
            style={f => {
              const km = (f as Feature<MultiPolygon, ZoneProps> | undefined)?.properties.km ?? 20;
              return km === 20
                ? { color: c.forest, weight: 1, fillColor: c.forest, fillOpacity: 0.06, renderer }
                : { color: c.forest, weight: 1, dashArray: '4 4', fill: false, opacity: km === 10 ? 0.6 : 0.4, renderer };
            }}
            onEachFeature={(f: Feature<MultiPolygon, ZoneProps>, layer) => { layer.bindTooltip(en.shadow.reachPopup(f.properties.nursery_name, f.properties.km), { sticky: true }); }}
          />
        )}
        {visible.has('cells') && cells && (
          <GeoJSON
            key={`cells-${runKey}`}
            data={asCollection<CellProps>(cells)}
            style={f => ({ color: c.laterite, weight: 0.6, opacity: 0.55, fillColor: c.laterite, fillOpacity: lossOpacity((f as Feature<MultiPolygon, CellProps> | undefined)?.properties.loss_pct ?? 0, threshold), renderer })}
            onEachFeature={(f: Feature<MultiPolygon, CellProps>, layer) => { layer.bindTooltip(en.shadow.cellPopup(pctText(f.properties.loss_pct), f.properties.in_shadow), { sticky: true }); }}
          />
        )}
        {visible.has('shadows') && shadows && (
          <GeoJSON
            key={`shadows-${runKey}-${String(selected)}`}
            data={asCollection<ShadowProps>(shadows)}
            style={f => {
              const on = (f as Feature<MultiPolygon, ShadowProps> | undefined)?.properties.id === selected;
              return { color: on ? c.canopy : c.laterite, weight: on ? 4 : 2.5, dashArray: on ? undefined : '6 4', fillColor: c.laterite, fillOpacity: on ? 0.25 : 0.1, renderer };
            }}
            onEachFeature={(f: Feature<MultiPolygon, ShadowProps>, layer) => {
              const p = f.properties;
              layer.bindTooltip(en.shadow.zonePopup(pctText(p.area_km2), pctText(p.loss_pct), p.district ?? en.shadow.unknownDistrict), { sticky: true });
              layer.on('click', () => { onSelect(p.id); });
            }}
          />
        )}
        {visible.has('nurseries') && nurseries.map(n => (
          <Marker key={n.id} position={[n.lat, n.lng]} icon={pin} keyboard={false}>
            <Tooltip>{n.name}</Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
export default ShadowMap;
