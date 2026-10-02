import { BRAND_MARK_BODY, BRAND_MARK_VIEWBOX } from './brandMarkSvg';

/** The Nursery Link mark (see brandMarkSvg.ts); also the favicon. */
export const BrandMark = ({ size = 32, className }: { size?: number; className?: string }) => (
  // A fixed drawing from our own source, never user input
  <svg width={size} height={size} viewBox={BRAND_MARK_VIEWBOX} aria-hidden="true" className={className} dangerouslySetInnerHTML={{ __html: BRAND_MARK_BODY }} />
);
