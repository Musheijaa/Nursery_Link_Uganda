import type { MobileMoneyMethod } from '@nurserylink/shared';
import { cn } from '@nurserylink/ui';
import { en } from '../copy/en';

/*
 * MTN MoMo and Airtel Money with their own logos (public/brands; files from Wikimedia Commons).
 * The logos are the companies' trademarks, shown only to say which mobile money services the site
 * takes; confirm each provider's merchant brand rules before launch.
 */

const SIZES = {
  sm: { box: 'h-7 gap-1.5 px-2 text-xs', mtn: 'h-4', airtel: 'h-5' },
  md: { box: 'h-9 gap-2 px-2.5 text-sm', mtn: 'h-5', airtel: 'h-6' },
  lg: { box: 'h-12 gap-2.5 px-3 text-base', mtn: 'h-7', airtel: 'h-9' },
} as const;

/**
 * Just the logo, large, on a square tile in the brand's colour: for choices that already carry
 * the service's name (the checkout's payment options).
 */
export const MobileMoneyMark = ({ method, className }: { method: MobileMoneyMethod; className?: string }) =>
  method === 'mtn_momo' ? (
    <span aria-hidden className={cn('flex size-16 shrink-0 items-center justify-center rounded-lg bg-[#ffcb05] shadow-card', className)}>
      <img src="/brands/mtn.svg" alt="" width={52} height={26} className="w-13" />
    </span>
  ) : (
    <span aria-hidden className={cn('flex size-16 shrink-0 items-center justify-center rounded-lg bg-paper shadow-card ring-1 ring-line', className)}>
      <img src="/brands/airtel.svg" alt="" width={40} height={42} className="h-11 w-auto" />
    </span>
  );

/** One service as a logo tile in its brand colours: MTN on MTN yellow, Airtel red on white. */
export const MobileMoneyLogo = ({ method, size = 'md', className, decorative = false }: {
  method: MobileMoneyMethod;
  size?: keyof typeof SIZES;
  className?: string;
  /** Next to a visible name (e.g. a payment choice), so screen readers don't hear it twice */
  decorative?: boolean;
}) => {
  const s = SIZES[size];
  const a11y = (label: string) => (decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label });
  return method === 'mtn_momo' ? (
    <span {...a11y(en.checkout.methods.mtn_momo)} className={cn('inline-flex shrink-0 items-center rounded-md bg-[#ffcb05] font-bold text-[#1a1a1a] shadow-card', s.box, className)}>
      <img src="/brands/mtn.svg" alt="" width={48} height={24} className={cn('w-auto', s.mtn)} />
      <span aria-hidden>{en.payments.momo}</span>
    </span>
  ) : (
    <span {...a11y(en.checkout.methods.airtel_money)} className={cn('inline-flex shrink-0 items-center rounded-md bg-paper font-bold text-[#e40000] shadow-card ring-1 ring-line', s.box, className)}>
      <img src="/brands/airtel.svg" alt="" width={24} height={25} className={cn('w-auto', s.airtel)} />
      <span aria-hidden>{en.payments.airtelMoney}</span>
    </span>
  );
};

/** Both services, e.g. "Mobile money payments coming soon: [MTN MoMo] [Airtel Money]". */
export const MobileMoneyBadges = ({ className, size = 'lg' }: { className?: string; size?: keyof typeof SIZES }) => (
  <ul aria-label={en.payments.methodsLabel} className={cn('flex flex-wrap items-center gap-2', className)}>
    <li><MobileMoneyLogo method="mtn_momo" size={size} /></li>
    <li><MobileMoneyLogo method="airtel_money" size={size} /></li>
  </ul>
);
