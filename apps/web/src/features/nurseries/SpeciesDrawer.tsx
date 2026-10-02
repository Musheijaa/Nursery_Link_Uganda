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
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <SpeciesPill category={s.category} />
            <span aria-hidden>·</span>
            <span>{en.speciesDrawer.pace[s.growth_pace]}</span>
          </p>
          {s.local_names.length > 0 && (
            <p className="text-sm">
              <span className="font-bold">{en.speciesDrawer.localNames}: </span>
              {s.local_names.map(l => `${l.name} (${l.language})`).join(', ')}
            </p>
          )}
          {s.canopy_notes && (
            <div>
              <h3 className="text-base">{en.speciesDrawer.canopy}</h3>
              <p>{s.canopy_notes}</p>
            </div>
          )}
          {s.root_notes && (
            <div>
              <h3 className="text-base">{en.speciesDrawer.roots}</h3>
              <p>{s.root_notes}</p>
            </div>
          )}
          {s.ecological_zones.length > 0 && (
            <div>
              <h3 className="text-base">{en.speciesDrawer.zones}</h3>
              <p>{s.ecological_zones.join(' · ')}</p>
            </div>
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
