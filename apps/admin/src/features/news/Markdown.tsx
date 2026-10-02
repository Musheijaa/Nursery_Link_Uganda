import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useMemo } from 'react';

/** The same rendering as the public article page: Markdown → sanitised HTML. */
export const Markdown = ({ source }: { source: string }) => {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(source, { async: false, gfm: true })), [source]);
  return (
    <div
      className="flex flex-col gap-3 leading-relaxed text-bark [&_a]:font-bold [&_a]:underline [&_h2]:text-xl [&_h3]:text-lg [&_li]:ml-6 [&_ol]:list-decimal [&_ul]:list-disc"
      // Safe: sanitised by DOMPurify above
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
