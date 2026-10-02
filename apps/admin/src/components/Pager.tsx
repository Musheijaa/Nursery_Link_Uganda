import { Button } from '@nurserylink/ui';
import { en } from '../copy/en';

export const Pager = ({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) => {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-2 text-sm">
      <span className="text-bark-muted">{en.common.page(page, pages, total)}</span>
      <span className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => { onPage(page - 1); }}>{en.common.previous}</Button>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => { onPage(page + 1); }}>{en.common.next}</Button>
      </span>
    </nav>
  );
};
