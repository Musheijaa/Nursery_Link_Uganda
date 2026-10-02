import type { MobileMoneyMethod } from '@nurserylink/shared';
import { cn } from '@nurserylink/ui';
import { en } from '../copy/en';

/*
 * MTN MoMo and Airtel Money with their own logos (public/brands; files from Wikimedia Commons).
 * The logos are the companies' trademarks, shown only to say which mobile money services the site
 * takes; confirm each provider's merchant brand rules before launch.
 */

/** Logo heights: MTN's oval is twice as wide as it is tall, Airtel's mark about square. */
const SIZES = {
  sm: { mtn: 'h-8', airtel: 'h-10' },
  md: { mtn: 'h-10', airtel: 'h-12' },
  lg: { mtn: 'h-14', airtel: 'h-16' },
  xl: { mtn: 'h-16', airtel: 'h-20' },
} as const;

const FILES = {
  mtn_momo: { src: '/brands/mtn.svg', width: 128, height: 64, size: 'mtn' },
  airtel_money: { src: '/brands/airtel.svg', width: 96, height: 100, size: 'airtel' },
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
      className={cn('w-auto shrink-0', SIZES[size][f.size], className)}
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
