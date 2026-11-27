import type { PageContentKey } from '@nurserylink/shared';
import type { ReactNode } from 'react';
import type { IMAGES } from '../data/images';
import { paragraphs, usePageCopy } from '../features/content/api';
import { PageHero } from './PageHero';

/**
 * A section page's introduction from the client's copy (admin-editable): the title and subtitle on the
 * photo band, then the introduction as readable paragraphs underneath.
 */
export const ContentHero = ({ contentKey, photo, focus, children }: {
  contentKey: PageContentKey;
  photo: keyof typeof IMAGES;
  focus?: string;
  children?: ReactNode;
}) => {
  const copy = usePageCopy(contentKey);
  const body = paragraphs(copy.body);
  return (
    <>
      <PageHero title={copy.title} intro={copy.subtitle ?? undefined} photo={photo} focus={focus}>
        {children}
      </PageHero>
      {body.length > 0 && (
        <div className="flex max-w-3xl flex-col gap-3 text-lg text-bark">
          {body.map(lines => (
            <p key={lines.join()}>{lines.map((line, i) => (i === 0 ? line : <span key={line}><br />{line}</span>))}</p>
          ))}
        </div>
      )}
    </>
  );
};
