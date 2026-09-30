import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';
import { IMAGES } from '../data/images';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-stone-300',
  secondary: 'bg-white text-stone-800 border border-stone-300 hover:bg-stone-50 disabled:text-stone-400',
  ghost: 'text-brand-700 hover:bg-brand-50 disabled:text-stone-400',
  danger: 'bg-white text-soil-700 border border-soil-200 hover:bg-soil-50',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
> = ({ variant = 'primary', size = 'md', className = '', type = 'button', ...props }) => (
  <button
    type={type}
    className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
    {...props}
  />
);

type BadgeTone = 'neutral' | 'green' | 'soil' | 'amber';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-stone-100 text-stone-700',
  green: 'bg-brand-50 text-brand-800',
  soil: 'bg-soil-50 text-soil-700',
  amber: 'bg-amber-50 text-amber-800',
};

export const Badge: React.FC<{ tone?: BadgeTone; children: React.ReactNode; className?: string }> = ({
  tone = 'neutral',
  children,
  className = '',
}) => (
  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone]} ${className}`}>
    {children}
  </span>
);

export const inputClass =
  'w-full h-10 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20';

export const Field: React.FC<{
  label: string;
  hint?: string;
  error?: string | null;
  children: (id: string) => React.ReactNode;
}> = ({ label, hint, error, children }) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-stone-800">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p className="mt-1 text-xs text-soil-700">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-stone-500">{hint}</p>
      ) : null}
    </div>
  );
};

export const Modal: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'md' | 'lg';
}> = ({ title, onClose, children, size = 'md' }) => {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-xl bg-white shadow-xl sm:rounded-xl ${size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-800" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
};

export const Photo: React.FC<{ imageKey: string; className?: string; eager?: boolean }> = ({
  imageKey,
  className = '',
  eager = false,
}) => {
  const image = IMAGES[imageKey];
  if (!image) return null;
  return (
    <img
      src={image.src}
      alt={image.alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={`object-cover ${className}`}
    />
  );
};

export const PageHeader: React.FC<{ title: string; intro?: React.ReactNode; actions?: React.ReactNode }> = ({
  title,
  intro,
  actions,
}) => (
  <div className="flex flex-col gap-4 border-b border-stone-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      {intro && <p className="mt-2 text-stone-600">{intro}</p>}
    </div>
    {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
  </div>
);

export const EmptyState: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-lg border border-dashed border-stone-300 px-6 py-10 text-center">
    <p className="font-medium text-stone-800">{title}</p>
    {children && <div className="mt-2 text-sm text-stone-600">{children}</div>}
  </div>
);

export const Container: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>
);
