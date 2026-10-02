import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useMemo } from 'react';

/**
 * Renders an article body written in Markdown by admins. The HTML is sanitised before it is
 * inserted, so a pasted script or event handler can never run on the site.
 */
export const Markdown = ({ source }: { source: string }) => {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(source, { async: false, gfm: true, breaks: false })), [source]);
  return (
    <div
      className="flex flex-col gap-4 text-lg leading-relaxed text-bark [&_a]:font-bold [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-forest [&_blockquote]:pl-4 [&_h2]:text-xl [&_h3]:text-lg [&_li]:ml-6 [&_ol]:list-decimal [&_ul]:list-disc"
      // Safe: sanitised by DOMPurify above
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
