import { useEffect, type ReactNode } from 'react';
import { en } from '../copy/en';

/** Page title (also the browser tab), an optional intro, and actions on the right. */
export const PageHeader = ({ title, intro, actions }: { title: string; intro?: ReactNode; actions?: ReactNode }) => {
  useEffect(() => { document.title = `${title} · ${en.app.name}`; }, [title]);
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl">{title}</h1>
        {intro && <p className="max-w-3xl text-bark-muted">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
};
