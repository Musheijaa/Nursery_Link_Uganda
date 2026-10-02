import { cn } from '@nurserylink/ui';
import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { en } from '../copy/en';

/** A search box that reports what was typed after a short pause (so each keystroke isn't a request). */
export const SearchBox = ({ value, onChange, className, label = en.nurseries.searchLabel, placeholder = en.nurseries.searchPlaceholder, id = 'search' }: {
  value: string;
  onChange: (q: string) => void;
  className?: string;
  label?: string;
  placeholder?: string;
  id?: string;
}) => {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  // Follow outside changes (back button, "Clear filters")
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }
  useEffect(() => {
    if (text === value) return;
    const timer = window.setTimeout(() => { onChange(text); }, 300);
    return () => { window.clearTimeout(timer); };
  }, [text, value, onChange]);

  return (
    <div role="search" className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-bark-muted" />
      <input
        id={id}
        type="search"
        enterKeyHint="search"
        value={text}
        onChange={e => { setText(e.target.value); }}
        placeholder={placeholder}
        className="block min-h-12 w-full rounded-sm border border-field bg-paper pr-12 pl-10 text-base placeholder:text-bark-muted [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={() => { setText(''); onChange(''); }}
          aria-label={en.nurseries.clearSearch}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-bark-muted hover:text-forest"
        >
          <X aria-hidden className="size-5" />
        </button>
      )}
    </div>
  );
};

