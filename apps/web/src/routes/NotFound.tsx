import { Button, EmptyState } from '@nurserylink/ui';
import { Link } from 'react-router';
import { en } from '../copy/en';
import { usePageTitle } from '../components/usePageTitle';

export const NotFoundPage = () => {
  usePageTitle(en.notFound.title);
  return (
    <EmptyState
      headingLevel={1}
      title={en.notFound.title}
      action={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link to="/nurseries">{en.notFound.findNurseries}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/">{en.states.goHome}</Link>
          </Button>
        </div>
      }
    >
      {en.notFound.body}
    </EmptyState>
  );
};

export default NotFoundPage;
