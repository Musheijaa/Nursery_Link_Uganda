import React from 'react';

export const LogoMark: React.FC<{ className?: string }> = ({ className = 'h-8 w-8' }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <rect width="32" height="32" rx="7" className="fill-brand-700" />
    <path d="M16 26v-9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M16 17c0-5 3.5-9 9-10-.5 5.5-4 9.5-9 10Z" fill="#fff" />
    <path d="M16 20c0-4-2.8-7.2-7.2-8 .4 4.4 3.2 7.6 7.2 8Z" className="fill-soil-300" />
  </svg>
);

export const Logo: React.FC<{ onClick?: () => void }> = ({ onClick }) => (
  <button onClick={onClick} className="flex items-center gap-2.5" aria-label="Nursery Link Uganda home">
    <LogoMark />
    <span className="text-left leading-tight">
      <span className="block text-base font-bold text-stone-900">Nursery Link</span>
      <span className="block text-[11px] font-medium uppercase tracking-wide text-stone-500">Uganda</span>
    </span>
  </button>
);
