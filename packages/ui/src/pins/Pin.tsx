import { clusterPinSvg, nurseryPinSvg, type PinKind } from './pins';

/** React rendering of the map pins, for legends and the design reference page. */
export const NurseryPin = ({ kind, selected = false, label }: { kind: PinKind; selected?: boolean; label?: string }) => (
  <span role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="inline-block leading-none" dangerouslySetInnerHTML={{ __html: nurseryPinSvg(kind, selected) }} />
);

export const ClusterPin = ({ count, hasGift = false }: { count: number; hasGift?: boolean }) => (
  <span aria-hidden className="inline-block leading-none" dangerouslySetInnerHTML={{ __html: clusterPinSvg(count, hasGift) }} />
);
