import { AdvancedMarker, Map as GoogleMap } from '@vis.gl/react-google-maps';
import type { LatLng } from '../lib/geo';
import { GOOGLE_MAP_ID, MapUnavailable, MapsProvider, mapsAvailable } from '../lib/googleMaps';
import { useOnline } from '../lib/online';
import { DROP_PIN_SVG, DashedLine, FitPoints, NurseryPinContent, SvgPin } from './MapPins';

/** A nursery pin, and optionally a drop point, framed together (order map, giveaway pickup). */
const LocationMap = ({ nursery, drop = null, label }: { nursery: LatLng; drop?: LatLng | null; label: string }) => {
  const online = useOnline();
  const box = 'relative isolate h-72 overflow-hidden rounded-md ring-1 ring-line md:h-96';
  if (!mapsAvailable || !online) return <MapUnavailable reason={online ? 'no_key' : 'offline'} className={box} />;
  return (
    <MapsProvider>
      <div role="region" aria-label={label} className={box}>
        <GoogleMap mapId={GOOGLE_MAP_ID} defaultCenter={nursery} defaultZoom={14} className="size-full" gestureHandling="cooperative" streetViewControl={false} mapTypeControl={false} fullscreenControl={false} clickableIcons={false}>
          <FitPoints points={drop ? [nursery, drop] : [nursery]} />
          <AdvancedMarker position={nursery}><NurseryPinContent /></AdvancedMarker>
          {drop && (
            <>
              <DashedLine from={nursery} to={drop} />
              <AdvancedMarker position={drop}><SvgPin svg={DROP_PIN_SVG} /></AdvancedMarker>
            </>
          )}
        </GoogleMap>
      </div>
    </MapsProvider>
  );
};
export default LocationMap;
