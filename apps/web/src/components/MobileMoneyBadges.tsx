import type { MobileMoneyMethod } from '@nurserylink/shared';
import { cn } from '@nurserylink/ui';
import { en } from '../copy/en';

/*
 * MTN MoMo and Airtel Money, shown with the project owner's own images of each provider's artwork
 * (public/brands), whole and uncropped. The logos are the providers' trademarks, shown only to say
 * which mobile money services the site takes; confirm their merchant brand rules before launch.
 */

/** Heights; each image keeps its own shape (MTN 3:2, Airtel square). */
const SIZES = {
  sm: 'h-10',
  md: 'h-12',
  lg: 'h-16',
  xl: 'h-24',
} as const;

const FILES = {
  mtn_momo: { src: '/brands/mtn-momo.jpg', width: 360, height: 240 },
  airtel_money: { src: '/brands/airtel-money.jpg', width: 240, height: 240 },
} as const;

/** A provider's logo on its own, large, with no box around it. */
export const MobileMoneyLogo = ({ method, size = 'lg', className, decorative = false }: {
  method: MobileMoneyMethod;
  size?: keyof typeof SIZES;
  className?: string;
  /** Next to a visible name (e.g. a payment choice), so screen readers don't hear it twice */
  decorative?: boolean;
}) => {
  const f = FILES[method];
  return (
    <img
      src={f.src}
      alt={decorative ? '' : en.checkout.methods[method]}
      width={f.width}
      height={f.height}
      className={cn('w-auto shrink-0', SIZES[size], className)}
    />
  );
};

/** Both services, e.g. under "Mobile money payments coming soon". */
export const MobileMoneyBadges = ({ className, size = 'md' }: { className?: string; size?: keyof typeof SIZES }) => (
  <ul aria-label={en.payments.methodsLabel} className={cn('flex flex-wrap items-center gap-6', className)}>
    <li><MobileMoneyLogo method="mtn_momo" size={size} /></li>
    <li><MobileMoneyLogo method="airtel_money" size={size} /></li>
  </ul>
);
