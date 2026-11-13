import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useMemo, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';

/** Site paths are followed inside the app; anything else must be a plain web link. */
const isSitePath = (href: string) => href.startsWith('/') && !href.startsWith('//');

/**
 * Renders an assistant answer (Markdown, possibly half-written while it streams). The HTML is
 * sanitised; links to other websites open in a new tab, and links on this site navigate in place
 * (then `onNavigate` closes the panel).
 */
export const AnswerMarkdown = ({ source, onNavigate }: { source: string; onNavigate: () => void }) => {
  const navigate = useNavigate();
  const html = useMemo(() => {
    const raw = marked.parse(source, { async: false, gfm: true, breaks: false });
    const clean = DOMPurify.sanitize(raw, { FORBID_TAGS: ['img', 'style', 'form', 'input'], ALLOWED_URI_REGEXP: /^(?:https:\/\/|\/(?!\/))/i });
    const doc = new DOMParser().parseFromString(clean, 'text/html');
    for (const a of doc.querySelectorAll('a')) {
      const href = a.getAttribute('href') ?? '';
      if (!isSitePath(href)) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    }
    return doc.body.innerHTML;
  }, [source]);

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const link = (e.target as HTMLElement).closest('a');
    const href = link?.getAttribute('href');
    if (!href || !isSitePath(href) || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate();
    void navigate(href);
  };

  return (
    // Clicks are delegated to the links inside, which are keyboard-focusable themselves
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      onClick={onClick}
      className="flex flex-col gap-2 text-body-sm leading-relaxed text-bark [overflow-wrap:anywhere] [&_a]:font-bold [&_a]:text-forest [&_a]:underline [&_a]:underline-offset-2 [&_h1]:text-base [&_h2]:text-base [&_h3]:text-base [&_h1,&_h2,&_h3]:font-bold [&_li]:ml-5 [&_li+li]:mt-1 [&_ol]:list-decimal [&_strong]:font-bold [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:border-line [&_td]:px-2 [&_th]:border [&_th]:border-line [&_th]:px-2 [&_ul]:list-disc"
      // Safe: sanitised by DOMPurify above
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
