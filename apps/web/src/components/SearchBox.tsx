import { cn } from '@nurserylink/ui';
import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { en } from '../copy/en';
import { useSuggestions, type Suggestion, type SuggestionKind } from '../features/search/api';
import { suggestionOption } from '../features/search/options';
import { useDebounced } from '../lib/useDebounced';
import { Combobox } from './Combobox';

export interface SuggestConfig {
  types: readonly SuggestionKind[];
  /** Called with the chosen suggestion; returns the text the box should show afterwards */
  onPick: (s: Suggestion) => string;
}

/**
 * A search box that reports what was typed after a short pause (so each keystroke isn't a request).
 * With `suggest`, it also lists matching trees, nurseries or places as you type, spelling mistakes
 * forgiven, and choosing one runs `suggest.onPick`.
 */
export const SearchBox = ({ value, onChange, className, label = en.nurseries.searchLabel, placeholder = en.nurseries.searchPlaceholder, id = 'search', suggest }: {
  value: string;
  onChange: (q: string) => void;
  className?: string;
  label?: string;
  placeholder?: string;
  id?: string;
  suggest?: SuggestConfig;
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

  const typed = useDebounced(text.trim(), 200);
  const suggestions = useSuggestions(typed, suggest?.types ?? [], suggest !== undefined);
  const items = typed.length >= 2 && text.trim().length >= 2 ? (suggestions.data?.data ?? []) : [];

  const icon = <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-bark-muted" />;
  const clear = text && (
    <button
      type="button"
      onClick={() => { setText(''); onChange(''); }}
      aria-label={en.nurseries.clearSearch}
      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-bark-muted hover:text-forest"
    >
      <X aria-hidden className="size-5" />
    </button>
  );

  if (suggest) {
    return (
      <div role="search" className={className}>
        <Combobox
          id={id}
          label={label}
          value={text}
          onChange={setText}
          placeholder={placeholder}
          options={items.map(suggestionOption)}
          onSelect={i => {
            const chosen = items[i];
            if (chosen) setText(suggest.onPick(chosen));
          }}
          onEnter={() => { onChange(text); }}
          leading={icon}
          trailing={() => clear}
        />
      </div>
    );
  }

  return (
    <div role="search" className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">{label}</label>
      {icon}
      <input
        id={id}
        type="search"
        enterKeyHint="search"
        value={text}
        onChange={e => { setText(e.target.value); }}
        placeholder={placeholder}
        className="block min-h-12 w-full rounded-sm border border-field bg-paper pr-12 pl-10 text-base placeholder:text-bark-muted [&::-webkit-search-cancel-button]:hidden"
      />
      {clear}
    </div>
  );
};
