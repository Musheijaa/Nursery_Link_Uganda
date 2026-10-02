import { ErrorState, Field, Select, SkeletonList } from '@nurserylink/ui';
import { PageHeader } from '../components/PageHeader';
import { en } from '../copy/en';
import { CsvImport } from '../features/inventory/CsvImport';
import { StockGrid } from '../features/inventory/StockGrid';
import { useInventory } from '../features/inventory/api';
import { useNurseryOptions } from '../features/nurseries/api';
import { useParam } from '../lib/params';

const Inventory = () => {
  const [nursery, setNursery] = useParam('nursery');
  const nurseries = useNurseryOptions();
  const lines = useInventory(nursery);
  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <PageHeader title={en.inventory.title} />
      <Field label={en.inventory.chooseNursery} className="max-w-md">
        {({ id }) => (
          <Select id={id} value={nursery ?? ''} onChange={e => { setNursery(e.target.value || null); }}>
            <option value="">{en.inventory.pickNursery}</option>
            {nurseries.data?.map(n => <option key={n.id} value={n.id}>{n.name}{n.is_active ? '' : ` (${en.common.inactive})`}</option>)}
          </Select>
        )}
      </Field>
      {nursery && lines.isPending && <SkeletonList rows={4} />}
      {nursery && lines.isError && <ErrorState title={en.common.loadFailed} onRetry={() => { void lines.refetch(); }} retryLabel={en.common.retry} />}
      {nursery && lines.data && <StockGrid nurseryId={nursery} lines={lines.data} />}
      <CsvImport />
    </div>
  );
};
export default Inventory;
