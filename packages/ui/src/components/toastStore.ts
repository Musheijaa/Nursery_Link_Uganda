// A tiny global store, so any code (including query callbacks) can raise a toast. Kept apart from
// the <Toaster> component so raising a toast doesn't pull Radix Toast into the first page load.
export type Tone = 'success' | 'error' | 'info';
export interface ToastItem {
  id: number;
  title: string;
  description?: string | undefined;
  tone: Tone;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

export const toast = (title: string, options: { description?: string; tone?: Tone } = {}): void => {
  items = [...items, { id: nextId++, title, description: options.description, tone: options.tone ?? 'info' }];
  emit();
};
toast.success = (title: string, description?: string) => { toast(title, { tone: 'success', ...(description ? { description } : {}) }); };
toast.error = (title: string, description?: string) => { toast(title, { tone: 'error', ...(description ? { description } : {}) }); };

export const dismissToast = (id: number) => {
  items = items.filter(t => t.id !== id);
  emit();
};

export const subscribeToasts = (cb: () => void) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};
export const currentToasts = () => items;
