import type { Schemas } from '@nurserylink/api-client';
import { formatDate } from '@nurserylink/ui';
import { Link } from 'react-router';
import { NewsPill } from '../../components/Pills';
import { Picture } from '../../components/Picture';
import { postPhoto } from './photos';

type Post = Schemas['NewsListItem'];

const Meta = ({ post }: { post: Post }) => (
  <span className="flex flex-wrap items-center gap-2 text-sm text-bark-muted">
    <NewsPill category={post.category} />
    <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
  </span>
);

/**
 * One post in a list: category, date, title, and (in full lists) the opening lines and a photo
 * (the post's cover, or one for its category). `featured` is the large lead story.
 */
export const NewsCard = ({ post, compact = false, featured = false }: { post: Post; compact?: boolean; featured?: boolean }) => {
  if (featured) {
    return (
      <li>
        <Link to={`/news/${post.slug}`} className="group grid overflow-hidden rounded-lg bg-paper no-underline shadow-card ring-1 ring-line transition-shadow hover:shadow-lift md:grid-cols-2">
          <span className="relative block aspect-[3/2] md:aspect-auto md:min-h-64">
            <Picture src={postPhoto(post)} alt="" width={960} height={640} sizes="(min-width: 768px) 480px, 100vw" priority className="absolute inset-0 size-full object-cover" />
          </span>
          <span className="flex flex-col gap-2.5 p-5 md:p-6">
            <Meta post={post} />
            <span className="font-display text-2xl leading-tight font-semibold text-canopy group-hover:underline md:text-3xl">{post.title}</span>
            <span className="text-bark">{post.excerpt}</span>
          </span>
        </Link>
      </li>
    );
  }
  return (
    <li>
      <Link to={`/news/${post.slug}`} className="group flex h-full gap-4 rounded-lg bg-paper p-4 no-underline shadow-card ring-1 ring-line transition-shadow hover:shadow-lift">
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Meta post={post} />
          <span className="font-display text-xl leading-snug font-semibold text-canopy group-hover:underline">{post.title}</span>
          {!compact && <span className="line-clamp-3 text-bark">{post.excerpt}</span>}
        </span>
        {!compact && (
          <Picture src={postPhoto(post)} alt="" width={480} height={360} sizes="128px" className="size-16 shrink-0 self-start rounded-md object-cover sm:h-24 sm:w-32" />
        )}
      </Link>
    </li>
  );
};
