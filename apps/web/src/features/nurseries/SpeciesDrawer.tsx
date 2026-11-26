import { Drawer, SkeletonList, ErrorState } from '@nurserylink/ui';
import { BookOpen } from 'lucide-react';
import { Link } from 'react-router';
import { en } from '../../copy/en';
import { useSpecies } from './api';
import { SpeciesPill } from '../../components/Pills';

/** The Library entry for a tree, opened from a nursery's stock list without leaving the map (FR-21). */
export const SpeciesDrawer = ({ slug, onClose }: { slug: string | null; onClose: () => void }) => {
  const species = useSpecies(slug);
  const s = species.data;
  return (
    <Drawer open={slug !== null} onOpenChange={open => { if (!open) onClose(); }} title={s?.common_name ?? '…'} closeLabel={en.speciesDrawer.close}>
      {species.isPending && <SkeletonList rows={3} />}
      {species.isError && <ErrorState title={en.states.loadFailed} onRetry={() => { void species.refetch(); }} retryLabel={en.states.retry} />}
      {s && (
        <div className="flex flex-col gap-4">
          <p className="font-serif text-lg text-bark-muted italic">{s.scientific_name}</p>
          <ul aria-label={en.species.categoriesLabel} className="flex flex-wrap items-center gap-2 text-sm">
            {s.categories.map(c => <li key={c.slug}><SpeciesPill category={c} /></li>)}
          </ul>
          {s.local_names.length > 0 && (
            <p className="text-sm">
              <span className="font-bold">{en.speciesDrawer.localNames}: </span>
              {s.local_names.map(l => `${l.name} (${l.language})`).join(', ')}
            </p>
          )}
          {/* A short look: what it looks like, how it grows and what it is good for; the rest is on its page */}
          {(['appearance_and_identification', 'growth_characteristics', 'economic_uses', 'environmental_benefits'] as const).map(f =>
            s[f] ? (
              <div key={f}>
                <h3 className="text-base">{en.species.fields[f]}</h3>
                <p>{s[f]}</p>
              </div>
            ) : null
          )}
          <Link to={`/library/${s.slug}`} className="flex min-h-11 items-center gap-2 font-bold">
            <BookOpen aria-hidden className="size-5" />
            {en.speciesDrawer.openFull}
          </Link>
        </div>
      )}
    </Drawer>
  );
};
