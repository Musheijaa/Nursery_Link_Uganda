import { CloudOff, RotateCcw, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Button } from './Button';

interface StateProps {
  icon?: LucideIcon | undefined;
  title: string;
  /** What the user can do next */
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** 1 when the state is the whole page (404, a route that failed), so the page still has an h1 */
  headingLevel?: 1 | 2;
}

const Heading = ({ level = 2, children }: { level?: 1 | 2 | undefined; children: ReactNode }) =>
  level === 1 ? <h1 className="text-lg">{children}</h1> : <h2 className="text-lg">{children}</h2>;

/** Nothing to show yet: says why, and what to do next. */
export const EmptyState = ({ icon: Icon, title, children, action, className, headingLevel }: StateProps) => (
  <div className={cn('flex flex-col items-center gap-3 rounded-lg bg-paper shadow-card px-6 py-10 text-center ring-1 ring-line', className)}>
    {Icon && <Icon aria-hidden className="size-10 text-forest" strokeWidth={1.75} />}
    <Heading level={headingLevel}>{title}</Heading>
    {children && <div className="max-w-sm text-bark-muted">{children}</div>}
    {action}
  </div>
);

/** A failed load: what went wrong and a retry button. */
export const ErrorState = ({ title, children, onRetry, retryLabel = 'Try again', offline, className, headingLevel }: {
  title: string;
  headingLevel?: 1 | 2;
  children?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  offline?: boolean;
  className?: string;
}) => (
  <div role="alert" className={cn('flex flex-col items-center gap-3 rounded-lg bg-paper shadow-card px-6 py-10 text-center ring-1 ring-line', className)}>
    {offline && <CloudOff aria-hidden className="size-10 text-bark-muted" strokeWidth={1.75} />}
    <Heading level={headingLevel}>{title}</Heading>
    {children && <div className="max-w-sm text-bark-muted">{children}</div>}
    {onRetry && (
      <Button variant="secondary" onClick={onRetry}>
        <RotateCcw aria-hidden />
        {retryLabel}
      </Button>
    )}
  </div>
);

/** Sits at the top of the page while offline, or above data served from the offline cache. */
export const OfflineBanner = ({ children }: { children: ReactNode }) => (
  <div role="status" className="flex items-center gap-2 bg-canopy px-4 py-2 text-sm text-paper">
    <CloudOff aria-hidden className="size-4 shrink-0" />
    <span>{children}</span>
  </div>
);
