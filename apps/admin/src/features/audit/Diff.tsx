import { cn } from '@nurserylink/ui';
import { en } from '../../copy/en';

type Json = unknown;

const show = (v: Json) => (v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v));
const isObj = (v: Json): v is Record<string, Json> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Field-by-field before/after: changed fields highlighted, unchanged ones muted. */
export const Diff = ({ before, after }: { before: Json; after: Json }) => {
  if (before == null && after == null) return <p className="text-sm text-bark-muted">{en.audit.noChange}</p>;
  const b = isObj(before) ? before : before == null ? {} : { value: before };
  const a = isObj(after) ? after : after == null ? {} : { value: after };
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return (
    <table className="w-full table-fixed border-collapse text-xs">
      <thead>
        <tr className="text-left">
          <th scope="col" className="w-40 px-2 py-1" />
          <th scope="col" className="px-2 py-1">{en.audit.before}</th>
          <th scope="col" className="px-2 py-1">{en.audit.after}</th>
        </tr>
      </thead>
      <tbody>
        {keys.map(k => {
          const changed = show(b[k]) !== show(a[k]);
          return (
            <tr key={k} className={cn('border-t border-line align-top', !changed && 'text-bark-muted')}>
              <th scope="row" className="px-2 py-1 text-left font-mono font-normal">{k}</th>
              <td className={cn('px-2 py-1 font-mono break-words', changed && b[k] !== undefined && 'bg-laterite-tint text-laterite')}>{show(b[k])}</td>
              <td className={cn('px-2 py-1 font-mono break-words', changed && a[k] !== undefined && 'bg-seedling-tint text-canopy')}>{show(a[k])}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
