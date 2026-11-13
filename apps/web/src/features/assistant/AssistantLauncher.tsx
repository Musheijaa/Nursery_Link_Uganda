import { cn } from '@nurserylink/ui';
import { MessageCircleQuestion } from 'lucide-react';
import { lazy, Suspense, useSyncExternalStore } from 'react';
import { en } from '../../copy/en';
import { useAssistantMode } from '../feedback/api';

// The panel (and the Markdown renderer) load on the first tap, not with the page
const AssistantPanel = lazy(() => import('./AssistantPanel'));

/** Whether the panel is open, shared by every button that opens it (header and floating). */
let panel = { open: false, loaded: false };
const listeners = new Set<() => void>();
const setOpen = (open: boolean) => {
  panel = { open, loaded: panel.loaded || open };
  for (const l of listeners) l();
};
const usePanel = () =>
  useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => panel,
    () => panel
  );

const useEnabled = () => {
  const mode = useAssistantMode();
  return mode.data !== undefined && mode.data !== 'off';
};

/** "Ask" in the header: on every page, including the map and checkout where nothing floats. */
export const AssistantHeaderButton = () => {
  const { open } = usePanel();
  if (!useEnabled()) return null;
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => { setOpen(true); }}
      className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-sm px-2.5 font-label text-label whitespace-nowrap text-paper hover:bg-paper/10"
    >
      <MessageCircleQuestion aria-hidden className="size-6 xl:size-5" />
      <span className="sr-only sm:not-sr-only">{en.assistant.openShort}</span>
    </button>
  );
};

/**
 * The floating "Ask Nursery Link" button, bottom right, on ordinary pages (`hidden` on pages
 * with their own bottom bars: the map, checkout), plus the panel itself.
 */
export const AssistantLauncher = ({ floating }: { floating: boolean }) => {
  const { open, loaded } = usePanel();
  const enabled = useEnabled();
  if (!enabled) return null;
  return (
    <>
      {floating && !open && (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => { setOpen(true); }}
          className={cn(
            'fixed right-4 z-30 flex min-h-13 items-center gap-2 rounded-full bg-murram py-3 pr-5 pl-4 font-bold text-paper shadow-float',
            'bottom-[max(1rem,env(safe-area-inset-bottom))] hover:bg-[color-mix(in_srgb,var(--color-murram),black_14%)] md:right-6 md:bottom-6'
          )}
        >
          <MessageCircleQuestion aria-hidden className="size-6" />
          {en.assistant.open}
        </button>
      )}
      {loaded && (
        <Suspense fallback={null}>
          <AssistantPanel open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  );
};
