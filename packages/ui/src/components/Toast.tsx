import * as RadixToast from '@radix-ui/react-toast';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { cn } from '../lib/cn';

import { currentToasts, dismissToast, subscribeToasts } from './toastStore';

const ICON = { success: CheckCircle2, error: CircleAlert, info: Info };
const TONE = { success: 'text-seedling', error: 'text-laterite', info: 'text-forest' };

/** Renders toasts in the bottom corner; mount once per app. */
export const Toaster = ({ closeLabel = 'Dismiss' }: { closeLabel?: string }) => {
  const current = useSyncExternalStore(subscribeToasts, currentToasts, currentToasts);
  return (
    <RadixToast.Provider duration={5000} swipeDirection="down">
      {current.map(t => {
        const Icon = ICON[t.tone];
        return (
          <RadixToast.Root
            key={t.id}
            type={t.tone === 'error' ? 'foreground' : 'background'}
            onOpenChange={open => { if (!open) dismissToast(t.id); }}
            className="flex items-start gap-3 rounded-lg bg-paper p-4 shadow-float ring-1 ring-line data-[state=open]:animate-sheet-in"
          >
            <Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', TONE[t.tone])} />
            <div className="flex-1">
              <RadixToast.Title className="font-bold text-bark">{t.title}</RadixToast.Title>
              {t.description && <RadixToast.Description className="text-sm text-bark-muted">{t.description}</RadixToast.Description>}
            </div>
            <RadixToast.Close aria-label={closeLabel} className="-m-2 flex size-11 items-center justify-center rounded-sm text-bark-muted hover:bg-mist">
              <X aria-hidden className="size-5" />
            </RadixToast.Close>
          </RadixToast.Root>
        );
      })}
      <RadixToast.Viewport className="fixed inset-x-4 bottom-4 z-[60] flex flex-col gap-2 outline-none sm:right-4 sm:left-auto sm:w-96" />
    </RadixToast.Provider>
  );
};
