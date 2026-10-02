import { BrandMark } from '@nurserylink/ui';
import { Link } from 'react-router';
import { en } from '../copy/en';

export const Logo = () => (
  <Link to="/" className="flex min-h-11 items-center gap-2.5 text-paper no-underline" aria-label={`${en.app.fullName}, ${en.app.home}`}>
    <BrandMark size={34} className="shrink-0 rounded-[9px] ring-1 ring-paper/15" />
    <span className="flex flex-col leading-none">
      <span className="font-display text-xl font-semibold tracking-tight">{en.app.name}</span>
      <span className="text-xs font-bold text-murram-light">{en.footer.country}</span>
    </span>
  </Link>
);
