import { cn } from '@nurserylink/ui';
import { en } from '../copy/en';

/**
 * MTN MoMo and Airtel Money, as simple badges in each brand's colours. They name the services; they
 * are not the companies' logo artwork (use their official marks only with permission).
 */
export const MobileMoneyBadges = ({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' }) => {
  const pad = size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3 text-sm';
  return (
    <ul aria-label={en.payments.methodsLabel} className={cn('flex flex-wrap items-center gap-2', className)}>
      <li className={cn('inline-flex items-center gap-1.5 rounded-md bg-[#ffcb05] font-bold text-[#1a1a1a] shadow-card', pad)}>
        <span className="rounded-full border-2 border-[#1a1a1a] px-1.5 leading-tight font-black tracking-tight">MTN</span>
        {en.payments.momo}
      </li>
      <li className={cn('inline-flex items-center gap-1.5 rounded-md bg-[#e4002b] font-bold text-paper shadow-card', pad)}>
        <span className="font-black tracking-tight lowercase">airtel</span>
        {en.payments.airtelMoney}
      </li>
    </ul>
  );
};
