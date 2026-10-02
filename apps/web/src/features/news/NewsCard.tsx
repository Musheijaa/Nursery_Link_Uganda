import type { Schemas } from '@nurserylink/api-client';
import { formatDate } from '@nurserylink/ui';
import { Link } from 'react-router';
import { NewsPill } from '../../components/Pills';


/** One post in a list: category, date, title, and (in full lists) the opening lines and cover photo. */
export const NewsCard = ({ post, compact = false }: { post: Schemas['NewsListItem']; compact?: boolean }) => (
  <li>
    <Link to={`/news/${post.slug}`} className="group flex gap-4 rounded-lg bg-paper p-4 no-underline shadow-card ring-1 ring-line transition-shadow hover:shadow-lift">
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2 text-sm text-bark-muted">
          <NewsPill category={post.category} />
          <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
        </span>
        <span className="font-display text-xl leading-snug font-semibold text-canopy group-hover:underline">{post.title}</span>
        {!compact && <span className="text-bark">{post.excerpt}</span>}
      </span>
      {!compact && post.cover_url && (
        <img src={post.cover_url} alt="" width={160} height={120} loading="lazy" decoding="async" className="hidden h-24 w-32 shrink-0 rounded-md object-cover sm:block" />
      )}
    </Link>
  </li>
);
