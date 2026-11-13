import * as RadixDialog from '@radix-ui/react-dialog';
import { ASSISTANT_LIMITS } from '@nurserylink/shared';
import { BrandMark, Button, cn } from '@nurserylink/ui';
import { ArrowUp, RotateCcw, Square, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useLocation } from 'react-router';
import { en } from '../../copy/en';
import { useOnline } from '../../lib/online';
import { useAssistantMode } from '../feedback/api';
import { AnswerMarkdown } from './AnswerMarkdown';
import { ask, reset, retry, stop, useConversation, type Turn } from './conversation';

const c = en.assistant;

/** Three dots that pulse while the assistant works (still when the person prefers less motion). */
const Working = ({ label }: { label: string }) => (
  <p className="flex items-center gap-2 text-sm text-bark-muted">
    <span aria-hidden className="flex gap-1">
      {[0, 150, 300].map(delay => (
        <span key={delay} className="size-1.5 rounded-full bg-forest motion-safe:animate-pulse" style={{ animationDelay: `${String(delay)}ms` }} />
      ))}
    </span>
    {label}
  </p>
);

const Message = ({ turn, last, onNavigate, onRetry }: { turn: Turn; last: boolean; onNavigate: () => void; onRetry: () => void }) => {
  if (turn.role === 'user') {
    return (
      <li className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-forest px-4 py-2.5 text-body-sm whitespace-pre-wrap text-paper [overflow-wrap:anywhere]">
          <span className="sr-only">{`${c.you}: `}</span>
          {turn.text}
        </p>
      </li>
    );
  }
  const note =
    turn.state === 'stopped' ? c.stopped
    : turn.stop === 'limit' ? c.limit
    : turn.stop === 'declined' && !turn.text ? c.declined
    : null;
  return (
    <li className="flex gap-2.5">
      <BrandMark size={28} className="mt-1 shrink-0 rounded-md ring-1 ring-line" />
      <div className="flex min-w-0 max-w-[90%] flex-col gap-2 rounded-2xl rounded-tl-sm bg-paper px-4 py-3 shadow-card ring-1 ring-line">
        <span className="sr-only">{`${c.assistantName}: `}</span>
        {turn.text && <AnswerMarkdown source={turn.text} onNavigate={onNavigate} />}
        {turn.state === 'streaming' && (turn.status || !turn.text) && <Working label={turn.status ?? c.thinking} />}
        {note && <p className="text-sm text-bark-muted italic">{note}</p>}
        {turn.state === 'error' && (
          <div className="flex flex-wrap items-center gap-2">
            <p role="alert" className="text-sm font-bold text-laterite">{turn.error}</p>
            {last && (
              <Button variant="secondary" size="sm" className="min-h-11" onClick={onRetry}>
                <RotateCcw aria-hidden />
                {c.retry}
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
};

/**
 * The site assistant: a panel from the right (the whole screen on phones) with the conversation,
 * suggestions to start from, and a box to type in. Loaded on first open.
 */
const AssistantPanel = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const { turns, busy } = useConversation();
  const { pathname } = useLocation();
  const online = useOnline();
  const mode = useAssistantMode();
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pinned = useRef(true);
  const close = () => { onOpenChange(false); };

  const last = turns.at(-1);
  // Keep the newest text in view while it streams, unless the person has scrolled up to read
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && pinned.current) list.scrollTop = list.scrollHeight;
  }, [turns, open]);

  // Screen readers hear the look-up status and then the finished answer once, not every streamed word
  const announcement =
    last?.role !== 'assistant' ? ''
    : last.state === 'streaming' ? (last.status ?? '')
    : last.state === 'done' ? `${c.answerReady} ${last.text.replace(/[*_#>`[\]]|\(\/[^)]*\)/g, '')}`
    : '';

  const submit = (text: string) => {
    if (!text.trim() || busy || !online) return;
    pinned.current = true;
    ask(text, pathname);
    setDraft('');
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(draft);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter (or a phone keyboard's return while composing) adds a line
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit(draft);
    }
  };
  const left = ASSISTANT_LIMITS.maxUserChars - draft.length;

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-canopy/40 data-[state=open]:animate-fade-in" />
        <RadixDialog.Content
          onOpenAutoFocus={e => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          className="fixed inset-0 z-50 flex flex-col bg-mist shadow-float data-[state=open]:animate-drawer-in sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[27rem] sm:max-w-full"
        >
          <div className="on-dark flex items-center gap-3 bg-canopy px-4 py-3">
            <BrandMark size={36} className="shrink-0 rounded-[9px] ring-1 ring-paper/15" />
            <div className="min-w-0 flex-1">
              <RadixDialog.Title className="font-display text-lg leading-tight font-semibold text-paper">{c.title}</RadixDialog.Title>
              <RadixDialog.Description className="text-sm text-mist/90">{c.subtitle}</RadixDialog.Description>
            </div>
            {turns.length > 0 && (
              <Button variant="ghost" size="icon" className="text-paper hover:bg-paper/10" aria-label={c.newChat} title={c.newChat} onClick={() => { reset(); inputRef.current?.focus(); }}>
                <RotateCcw aria-hidden />
              </Button>
            )}
            <RadixDialog.Close asChild>
              <Button variant="ghost" size="icon" className="text-paper hover:bg-paper/10" aria-label={c.close}>
                <X aria-hidden />
              </Button>
            </RadixDialog.Close>
          </div>

          <div
            ref={listRef}
            onScroll={e => {
              const el = e.currentTarget;
              pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
            }}
            className="flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4"
          >
            {mode.data === 'mock' && <p className="rounded-md bg-amber-tint px-3 py-2 text-sm text-bark">{c.testMode}</p>}
            <div className="flex gap-2.5">
              <BrandMark size={28} className="mt-1 shrink-0 rounded-md ring-1 ring-line" />
              <p className="max-w-[90%] rounded-2xl rounded-tl-sm bg-paper px-4 py-3 text-body-sm text-bark shadow-card ring-1 ring-line">{c.greeting}</p>
            </div>
            {turns.length === 0 ? (
              <section aria-labelledby="assistant-suggestions" className="flex flex-col gap-2 pl-10">
                <h2 id="assistant-suggestions" className="font-label text-sm text-bark-muted">{c.suggestionsLabel}</h2>
                <ul className="flex flex-col items-start gap-2">
                  {c.suggestions.map(s => (
                    <li key={s}>
                      <button
                        type="button"
                        disabled={!online}
                        onClick={() => { submit(s); }}
                        className="min-h-11 rounded-full border border-forest/40 bg-paper px-4 py-2 text-left text-sm font-semibold text-forest hover:border-forest hover:bg-forest-tint disabled:opacity-60"
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <ol aria-label={c.title} className="flex flex-col gap-4">
                {turns.map(turn => (
                  <Message key={turn.id} turn={turn} last={turn === last} onNavigate={close} onRetry={() => { retry(pathname); }} />
                ))}
              </ol>
            )}
          </div>

          <p aria-live="polite" className="sr-only">{announcement}</p>

          <form onSubmit={onSubmit} className="flex flex-col gap-1.5 border-t border-line bg-paper px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {!online && <p className="text-sm font-bold text-laterite">{c.offline}</p>}
            <div className="flex items-end gap-2">
              <label htmlFor="assistant-input" className="sr-only">{c.inputLabel}</label>
              <textarea
                id="assistant-input"
                ref={inputRef}
                value={draft}
                rows={1}
                maxLength={ASSISTANT_LIMITS.maxUserChars}
                placeholder={c.placeholder}
                onChange={e => { setDraft(e.target.value); }}
                onKeyDown={onKeyDown}
                aria-describedby="assistant-disclaimer"
                className="field-sizing-content max-h-36 min-h-11 flex-1 resize-none rounded-lg border border-field bg-paper px-3 py-2.5 text-base text-bark placeholder:text-bark-muted"
              />
              {busy ? (
                <Button type="button" variant="secondary" size="icon" aria-label={c.stop} title={c.stop} onClick={stop}>
                  <Square aria-hidden className="fill-current" />
                </Button>
              ) : (
                <Button type="submit" size="icon" aria-label={c.send} title={c.send} disabled={!draft.trim() || !online}>
                  <ArrowUp aria-hidden />
                </Button>
              )}
            </div>
            <div className="flex justify-between gap-3 text-xs text-bark-muted">
              <p id="assistant-disclaimer">{c.disclaimer}</p>
              {left < 100 && <p className={cn('shrink-0', left < 20 && 'font-bold text-laterite')}>{c.charsLeft(left)}</p>}
            </div>
          </form>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};
export default AssistantPanel;
