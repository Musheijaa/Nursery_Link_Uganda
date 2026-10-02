import { cn } from '@nurserylink/ui';
import { useState, type ReactNode } from 'react';
import { en } from '../copy/en';

export interface ComboOption {
  key: string;
  primary: ReactNode;
  secondary?: ReactNode;
  /** A short word on the right saying what kind of thing this is ("Tree", "Place") */
  tag?: string;
}

/**
 * A text box with a list of suggestions under it (WAI-ARIA 1.2 combobox with a listbox popup).
 * Up and down move through the list, Enter picks, Escape closes; focus stays in the box, and the
 * number of suggestions is announced to screen readers.
 */
export const Combobox = ({
  id, label, value, onChange, options, onSelect, onEnter, message, note, placeholder, className, inputClassName, leading, trailing, enterKeyHint = 'search', inline = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (text: string) => void;
  options: ComboOption[];
  onSelect: (index: number) => void;
  /** Enter pressed with no suggestion highlighted */
  onEnter?: () => void;
  /** Shown in the list when there are no options (e.g. "Searching…", "No places found") */
  message?: string | undefined;
  /** A line under the options (e.g. "Village search is unavailable right now") */
  note?: string | undefined;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  leading?: ReactNode;
  /** Buttons inside the box on the right; `open` shows the list again (after a search) */
  trailing?: (api: { open: () => void }) => ReactNode;
  enterKeyHint?: 'search' | 'go' | 'done';
  /** Show the list in the flow (pushing content down) instead of floating, e.g. inside a dialog that scrolls */
  inline?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // A new set of suggestions starts with nothing highlighted
  const optionsKey = options.map(o => o.key).join('|');
  const [seenKey, setSeenKey] = useState(optionsKey);
  if (seenKey !== optionsKey) {
    setSeenKey(optionsKey);
    setActive(-1);
  }

  const listId = `${id}-list`;
  const expanded = open && (options.length > 0 || Boolean(message));
  const pick = (i: number) => {
    onSelect(i);
    setOpen(false);
  };

  return (
    <div className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <div className="relative">
        {leading}
        <input
          id={id}
          type="search"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && active >= 0 ? `${id}-opt-${String(active)}` : undefined}
          autoComplete="off"
          enterKeyHint={enterKeyHint}
          value={value}
          placeholder={placeholder}
          onFocus={() => { setOpen(true); }}
          onBlur={() => { setOpen(false); }}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              if (options.length) setActive(a => (a + 1) % options.length);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              if (options.length) setActive(a => (a <= 0 ? options.length - 1 : a - 1));
            } else if (e.key === 'Enter') {
              if (expanded && active >= 0 && active < options.length) {
                e.preventDefault();
                pick(active);
              } else if (onEnter) {
                e.preventDefault();
                onEnter();
                setOpen(true);
              }
            } else if (e.key === 'Escape' && expanded) {
              e.preventDefault();
              setOpen(false);
            }
          }}
          className={cn('block min-h-12 w-full rounded-sm border border-field bg-paper pr-12 pl-10 text-base text-bark placeholder:text-bark-muted [&::-webkit-search-cancel-button]:hidden', inputClassName)}
        />
        {trailing?.({ open: () => { setOpen(true); } })}
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-label={en.search.listLabel}
        hidden={!expanded}
        className={cn('mt-1 max-h-80 overflow-y-auto rounded-md bg-paper py-1 text-left text-bark ring-1 ring-line', inline ? 'relative' : 'absolute inset-x-0 top-full z-[1100] shadow-float')}
      >
        {expanded && options.map((o, i) => (
          // Keyboard use goes through the box (aria-activedescendant), so options only need the pointer
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events
          <li
            key={o.key}
            id={`${id}-opt-${String(i)}`}
            role="option"
            aria-selected={i === active}
            // Keep focus in the box, so the list doesn't close before the click lands
            onMouseDown={e => { e.preventDefault(); }}
            onMouseMove={() => { setActive(i); }}
            onClick={() => { pick(i); }}
            className={cn('flex min-h-11 cursor-pointer items-center gap-3 px-3 py-1.5', i === active && 'bg-forest-tint')}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-bold text-canopy">{o.primary}</span>
              {o.secondary && <span className="truncate text-sm text-bark-muted">{o.secondary}</span>}
            </span>
            {o.tag && <span className="shrink-0 rounded-full bg-sand px-2 py-0.5 text-xs font-bold text-bark">{o.tag}</span>}
          </li>
        ))}
        {expanded && options.length === 0 && message && <li role="presentation" className="px-3 py-2 text-sm text-bark-muted">{message}</li>}
        {expanded && options.length > 0 && note && <li role="presentation" className="border-t border-line px-3 py-2 text-xs text-bark-muted">{note}</li>}
      </ul>
      <p className="sr-only" aria-live="polite">{expanded ? (options.length ? en.search.count(options.length) : message) : ''}</p>
    </div>
  );
};
