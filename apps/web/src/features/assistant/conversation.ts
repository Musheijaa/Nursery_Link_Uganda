import { isApiError } from '@nurserylink/api-client';
import { ASSISTANT_LIMITS, type AssistantChat, type AssistantEvent, type AssistantStop } from '@nurserylink/shared';
import { useSyncExternalStore } from 'react';
import { currentPosition } from '../nurseries/location';
import { streamAnswer } from './stream';

export interface Turn {
  id: string;
  role: 'user' | 'assistant';
  /** Markdown, growing while the answer streams */
  text: string;
  state: 'streaming' | 'done' | 'stopped' | 'error';
  /** What it is looking up right now ("Looking up nurseries…") */
  status?: string | undefined;
  stop?: AssistantStop | undefined;
  error?: string | undefined;
}

export interface Conversation {
  turns: Turn[];
  busy: boolean;
}

/**
 * The conversation lives outside React, so it survives closing and reopening the panel, and in
 * sessionStorage, so it survives a reload. It is never stored anywhere else.
 */
const STORAGE_KEY = 'nl.assistant';

const load = (): Turn[] => {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) return (JSON.parse(saved) as Turn[]).filter(t => t.state !== 'streaming');
  } catch (err) {
    console.warn('Could not restore the assistant conversation', err);
  }
  return [];
};

let state: Conversation = { turns: typeof window === 'undefined' ? [] : load(), busy: false };
let controller: AbortController | null = null;
const listeners = new Set<() => void>();

const set = (next: Conversation) => {
  state = next;
  for (const l of listeners) l();
  if (!next.busy) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next.turns));
    } catch (err) {
      console.warn('Could not save the assistant conversation', err);
    }
  }
};

const updateLast = (change: (turn: Turn) => Turn, busy = state.busy) => {
  const last = state.turns.at(-1);
  if (!last || last.role !== 'assistant') return;
  set({ busy, turns: [...state.turns.slice(0, -1), change(last)] });
};

const newId = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${String(Date.now())}-${String(Math.random())}`);

/** The recent exchanges the server needs, trimmed to its limits (the latest question last). */
export const historyFor = (turns: Turn[]): AssistantChat['messages'] =>
  turns
    .filter(t => t.text.trim() !== '' && (t.role === 'user' || t.state !== 'error'))
    .map(t => ({
      role: t.role,
      content: t.text.trim().slice(0, t.role === 'user' ? ASSISTANT_LIMITS.maxUserChars : ASSISTANT_LIMITS.maxAssistantChars),
    }))
    .slice(-ASSISTANT_LIMITS.maxMessages)
    // The server wants the conversation to start with a question
    .filter((m, i, all) => !(i === 0 && m.role === 'assistant' && all.length > 1));

const run = async (page: string) => {
  controller?.abort();
  const abort = new AbortController();
  controller = abort;
  const messages = historyFor(state.turns.slice(0, -1));
  const position = currentPosition();
  const onEvent = (event: AssistantEvent) => {
    switch (event.type) {
      case 'status':
        updateLast(t => ({ ...t, status: event.label }));
        break;
      case 'text':
        updateLast(t => ({ ...t, status: undefined, text: t.text + event.text }));
        break;
      case 'done':
        updateLast(t => ({ ...t, status: undefined, state: 'done', stop: event.stop }), false);
        break;
      case 'error':
        updateLast(t => ({ ...t, status: undefined, state: 'error', error: event.message }), false);
        break;
    }
  };
  try {
    await streamAnswer({ messages, page, ...(position ? { location: position } : {}) }, onEvent, abort.signal);
    // The stream ended without saying it was done (a dropped connection)
    if (state.busy && controller === abort) updateLast(t => (t.state === 'streaming' ? { ...t, status: undefined, state: 'error', error: 'The answer was interrupted. Try again.' } : t), false);
  } catch (err) {
    if (abort.signal.aborted) return;
    const message = isApiError(err) ? err.message : 'Something went wrong. Try again.';
    if (!isApiError(err)) console.error('Assistant request failed', err);
    updateLast(t => ({ ...t, status: undefined, state: 'error', error: message }), false);
  } finally {
    if (controller === abort) controller = null;
  }
};

/** Asks a new question, from the page the person is on. */
export const ask = (question: string, page: string) => {
  const text = question.trim();
  if (!text || state.busy) return;
  set({
    busy: true,
    turns: [...state.turns, { id: newId(), role: 'user', text, state: 'done' }, { id: newId(), role: 'assistant', text: '', state: 'streaming' }],
  });
  void run(page);
};

/** Asks the last question again after an error. */
export const retry = (page: string) => {
  const last = state.turns.at(-1);
  if (state.busy || last?.role !== 'assistant' || last.state !== 'error') return;
  set({ busy: true, turns: [...state.turns.slice(0, -1), { id: newId(), role: 'assistant', text: '', state: 'streaming' }] });
  void run(page);
};

/** Stops the answer being written (the server stops too, when the connection closes). */
export const stop = () => {
  controller?.abort();
  controller = null;
  updateLast(t => (t.state === 'streaming' ? { ...t, status: undefined, state: 'stopped' } : t), false);
};

/** Starts over with an empty conversation. */
export const reset = () => {
  stop();
  set({ busy: false, turns: [] });
};

export const useConversation = (): Conversation =>
  useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state
  );
