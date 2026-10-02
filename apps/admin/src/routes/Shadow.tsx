import { zodResolver } from '@hookform/resolvers/zod';
import { isApiError } from '@nurserylink/api-client';
import { FOREST_LOSS_FIRST_YEAR, shadowRunCreateSchema } from '@nurserylink/shared';
import { Badge, Button, ErrorState, Field, Input, Skeleton, SkeletonList, cn, formatCount, formatDateTime, formatRelative, toast } from '@nurserylink/ui';
import { AlertTriangle, Download, Info, Loader2, Play } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Pager } from '../components/Pager';
import { PageHeader } from '../components/PageHeader';
import { en } from '../copy/en';
import { useNurseryOptions } from '../features/nurseries/api';
import { downloadShadowGeoJson, useForestLossSource, useShadowLayer, useShadowRun, useShadowRuns, useStartRun, type LayerCollection, type ShadowRun } from '../features/shadow/api';
import type { MapLayer } from '../features/shadow/ShadowMap';
import { colours, lossBands } from '../features/shadow/style';
import { toastError } from '../lib/errors';
import { usePage, useParam } from '../lib/params';

const ShadowMap = lazy(() => import('../features/shadow/ShadowMap'));

type Input = z.input<typeof shadowRunCreateSchema>;
type Output = z.output<typeof shadowRunCreateSchema>;
/** What the forest-loss loader records in its audit entry (only the parts shown here). */
const loadSummarySchema = z.object({ sources: z.array(z.string()).default([]), rows: z.number().default(0) });

const SAMPLE_SOURCE = 'synthetic_dev_sample';
const STATUS_TONE = { queued: 'info', running: 'info', succeeded: 'positive', failed: 'danger' } as const;
const num = (n: number, digits = 1) => n.toLocaleString('en-UG', { maximumFractionDigits: digits });
const shadowZones = (c: LayerCollection | undefined) =>
  (c?.features ?? []).flatMap(f => ('area_km2' in f.properties ? [f.properties] : []));

/** Where the forest-loss data came from; invented sample data gets a clear warning. */
const DataSource = () => {
  const source = useForestLossSource();
  if (source.isPending) return <Skeleton className="h-16 rounded-md" />;
  const parsed = loadSummarySchema.safeParse(source.data?.after);
  if (!source.data || !parsed.success) {
    return <p role="note" className="flex gap-2 rounded-md bg-amber-tint p-3 text-sm text-amber ring-1 ring-amber"><AlertTriangle aria-hidden className="size-5 shrink-0" />{en.shadow.noData}</p>;
  }
  const after = parsed.data;
  const sample = after.sources.includes(SAMPLE_SOURCE);
  return (
    <div className={cn('flex flex-col gap-1 rounded-md p-3 text-sm ring-1', sample ? 'bg-amber-tint text-amber ring-amber' : 'bg-paper ring-line')}>
      <p className="flex items-center gap-2 font-bold">{sample ? <AlertTriangle aria-hidden className="size-4" /> : <Info aria-hidden className="size-4" />}{en.shadow.dataSource}</p>
      <p>{en.shadow.dataLoaded(formatCount(after.rows), formatRelative(source.data.created_at), after.sources.join(', '))}</p>
      {sample && <p className="font-bold">{en.shadow.sampleWarning}</p>}
    </div>
  );
};

const Legend = ({ threshold }: { threshold: number }) => {
  const c = colours();
  return (
    <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-bark-muted">
      {lossBands(threshold).map(b => (
        <li key={b.from} className="flex items-center gap-1.5">
          <span aria-hidden className="size-3.5 rounded-xs border" style={{ borderColor: c.laterite, background: `color-mix(in srgb, ${c.laterite} ${String(Math.round(b.opacity * 100))}%, transparent)` }} />
          {num(b.from)}–{num(b.to)}%
        </li>
      ))}
      <li className="flex items-center gap-1.5"><span aria-hidden className="h-3.5 w-5 rounded-xs border-2 border-dashed" style={{ borderColor: c.laterite }} />{en.shadow.legend.shadow}</li>
      <li className="flex items-center gap-1.5"><span aria-hidden className="h-3.5 w-5 rounded-xs border" style={{ borderColor: c.forest, background: 'color-mix(in srgb, var(--color-forest) 12%, transparent)' }} />{en.shadow.legend.reach}</li>
    </ul>
  );
};

type Message = { text: string; warnings: string[]; runId: string; outcome: 'new' | 'in_progress' | 'cached' };

/** The settings form. The outcome message lives in the page, so it survives switching to the new run. */
const RunForm = ({ initial, onStarted, message, setMessage }: { initial: Output; onStarted: (run: ShadowRun) => void; message: Message | null; setMessage: (m: Message | null) => void }) => {
  const start = useStartRun();
  const { register, handleSubmit, formState: { errors } } = useForm<Input, unknown, Output>({ resolver: zodResolver(shadowRunCreateSchema), defaultValues: initial });
  return (
    <form
      noValidate
      aria-labelledby="run-heading"
      className="flex flex-col gap-3 rounded-lg bg-paper shadow-card p-4 ring-1 ring-line"
      onSubmit={e => {
        void handleSubmit(values => {
          setMessage(null);
          start.mutate(values, {
            onSuccess: r => {
              const outcome = r.meta.outcome;
              setMessage({ text: en.shadow.outcome[outcome], warnings: r.meta.warnings ?? [], runId: r.data.id, outcome });
              onStarted(r.data);
            },
            onError: toastError,
          });
        })(e);
      }}
    >
      <h2 id="run-heading" className="text-base">{en.shadow.paramsHeading}</h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label={en.shadow.threshold} hint={en.shadow.thresholdHint} error={errors.threshold_pct?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} inputMode="decimal" aria-describedby={describedBy} invalid={invalid} {...register('threshold_pct', { valueAsNumber: true })} />}
        </Field>
        <Field label={en.shadow.sinceYear} hint={en.shadow.sinceYearHint(FOREST_LOSS_FIRST_YEAR)} error={errors.since_year?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} inputMode="numeric" aria-describedby={describedBy} invalid={invalid} {...register('since_year', { valueAsNumber: true })} />}
        </Field>
      </div>
      <Button type="submit" busy={start.isPending} className="self-start"><Play aria-hidden />{en.shadow.run}</Button>
      {message && (
        <div role="status" className="flex flex-col gap-1 text-sm">
          <p>{message.text}</p>
          {message.warnings.map(w => <p key={w} className="font-bold text-amber">{w}</p>)}
        </div>
      )}
    </form>
  );
};

const RunList = ({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) => {
  const [page, setPage] = usePage();
  const runs = useShadowRuns(page);
  if (runs.isPending) return <SkeletonList rows={3} />;
  if (runs.isError) return <ErrorState title={en.common.loadFailed} onRetry={() => { void runs.refetch(); }} retryLabel={en.common.retry} />;
  return (
    <section aria-labelledby="runs-heading" className="flex flex-col gap-2">
      <h2 id="runs-heading" className="text-base">{en.shadow.runs}</h2>
      {runs.data.data.length === 0 && <p className="text-sm text-bark-muted">{en.shadow.noRuns}</p>}
      <ul className="flex flex-col gap-1">
        {runs.data.data.map(r => (
          <li key={r.id}>
            <button
              type="button"
              aria-current={r.id === selectedId || undefined}
              onClick={() => { onSelect(r.id); }}
              className={cn('flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-left text-sm ring-1', r.id === selectedId ? 'bg-forest-tint ring-forest' : 'bg-paper ring-line hover:bg-mist')}
            >
              <span className="flex flex-col">
                <span className="font-bold">{en.shadow.runLabel(r.params.threshold_pct, r.params.since_year)}</span>
                <span className="text-xs text-bark-muted">{formatDateTime(r.created_at)}{r.status === 'succeeded' ? ` · ${en.shadow.zoneCount(r.summary.shadow_zones)}` : ''}</span>
              </span>
              <Badge tone={STATUS_TONE[r.status]}>{en.shadow.statuses[r.status]}</Badge>
            </button>
          </li>
        ))}
      </ul>
      {runs.data.meta.total > 10 && <Pager page={page} total={runs.data.meta.total} limit={10} onPage={setPage} />}
    </section>
  );
};

const RunView = ({ run }: { run: ShadowRun }) => {
  const [layers, setLayers] = useState<Set<MapLayer>>(new Set(['cells', 'shadows', 'nurseries']));
  const [selected, setSelected] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const shadows = useShadowLayer(run, 'shadows', true);
  const cells = useShadowLayer(run, 'cells', layers.has('cells'));
  const zones = useShadowLayer(run, 'zones', layers.has('zones'));
  const nurseries = useNurseryOptions();
  const mapNurseries = useMemo(() => (nurseries.data ?? []).filter(n => n.is_active).map(n => ({ id: n.id, name: n.name, lat: n.location.lat, lng: n.location.lng })), [nurseries.data]);
  const list = shadowZones(shadows.data);
  const toggle = (l: MapLayer) => { setLayers(prev => { const next = new Set(prev); if (next.has(l)) next.delete(l); else next.add(l); return next; }); };

  if (run.status === 'queued' || run.status === 'running') {
    return <p role="status" className="flex items-center gap-2 rounded-lg bg-paper shadow-card p-4 ring-1 ring-line"><Loader2 aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />{en.shadow.working}</p>;
  }
  if (run.status === 'failed') return <p role="alert" className="rounded-md bg-laterite-tint p-4 font-bold text-laterite">{en.shadow.failed(run.error ?? '?')}</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">{en.shadow.summary(run.summary.shadow_zones, num(run.summary.shadow_area_km2), run.summary.nurseries)}</p>
        {run.summary.shadow_zones > 0 && (
          <Button
            size="sm"
            variant="secondary"
            busy={exporting}
            onClick={() => {
              setExporting(true);
              downloadShadowGeoJson(run.id).then(() => { toast.success(en.shadow.exported); }, toastError).finally(() => { setExporting(false); });
            }}
          >
            <Download aria-hidden />
            {en.shadow.export}
          </Button>
        )}
      </div>
      <fieldset className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
        <legend className="sr-only">{en.shadow.layers}</legend>
        {(['cells', 'shadows', 'zones', 'nurseries'] as const).map(l => (
          <label key={l} className="flex min-h-9 items-center gap-2 text-sm">
            <input type="checkbox" className="size-5 accent-forest" checked={layers.has(l)} onChange={() => { toggle(l); }} />
            {en.shadow.layer[l]}
          </label>
        ))}
      </fieldset>
      <Legend threshold={run.params.threshold_pct} />
      <Suspense fallback={<Skeleton className="h-[28rem] rounded-md lg:h-[36rem]" />}>
        <ShadowMap
          runKey={run.id}
          threshold={run.params.threshold_pct}
          cells={cells.data}
          shadows={shadows.data}
          zones={zones.data}
          nurseries={mapNurseries}
          visible={layers}
          selected={selected}
          onSelect={setSelected}
        />
      </Suspense>
      <section aria-labelledby="zones-heading" className="flex flex-col gap-2">
        <h2 id="zones-heading" className="text-base">{en.shadow.zonesHeading}</h2>
        {shadows.isPending && <SkeletonList rows={3} />}
        {shadows.data && list.length === 0 && <p className="rounded-md bg-seedling-tint p-3 text-canopy">{en.shadow.noShadows}</p>}
        {list.length > 0 && (
          <div tabIndex={0} role="region" aria-label={en.common.scrollTable} className="overflow-x-auto rounded-lg bg-paper shadow-card ring-1 ring-line">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-sand/70">
                <tr>{[en.shadow.columns.rank, en.shadow.columns.district, en.shadow.columns.area, en.shadow.columns.loss, en.shadow.columns.show].map((h, i) => <th key={i} scope="col" className="h-9 border-b border-line px-3 text-left">{h}</th>)}</tr>
              </thead>
              <tbody>
                {list.map((z, i) => (
                  <tr key={z.id} className={cn(z.id === selected && 'bg-laterite-tint/60')} aria-selected={z.id === selected || undefined}>
                    <td className="h-9 border-b border-line px-3 tabular-nums">{i + 1}</td>
                    <td className="border-b border-line px-3">{z.district ?? en.shadow.unknownDistrict}</td>
                    <td className="border-b border-line px-3 tabular-nums">{en.shadow.km2(num(z.area_km2))}</td>
                    <td className="border-b border-line px-3 tabular-nums">{en.shadow.pct(num(z.loss_pct))}</td>
                    <td className="border-b border-line px-3"><Button size="sm" variant="ghost" onClick={() => { setSelected(z.id); }}>{en.shadow.show}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

/** Nursery Shadow: run the analysis, see where forest is being lost beyond every nursery's reach. */
const Shadow = () => {
  const [runParam, setRun] = useParam('run');
  const latest = useShadowRuns(1);
  // Without ?run, open the newest finished run (or the newest of any status)
  const fallback = latest.data?.data.find(r => r.status === 'succeeded') ?? latest.data?.data[0];
  const runId = runParam ?? fallback?.id ?? null;
  const run = useShadowRun(runId);
  const initial: Output = run.data ? { threshold_pct: run.data.params.threshold_pct, since_year: run.data.params.since_year } : { threshold_pct: 20, since_year: 2010 };
  const [message, setMessage] = useState<Message | null>(null);
  // "Started… the map appears when it finishes" is stale once that run has finished
  const finished = run.data?.id === message?.runId && (run.data?.status === 'succeeded' || run.data?.status === 'failed');
  const shownMessage = message && !(finished && message.outcome !== 'cached') ? message : null;

  return (
    <div className="max-w-7xl">
      <PageHeader title={en.shadow.title} intro={en.shadow.intro} />
      <div className="grid gap-5 xl:grid-cols-[22rem_1fr]">
        <div className="order-2 flex min-w-0 flex-col gap-4 xl:order-none">
          {/* Re-filled when another run's settings are shown */}
          <RunForm key={`${String(initial.threshold_pct)}:${String(initial.since_year)}`} initial={initial} message={shownMessage} setMessage={setMessage} onStarted={r => { setRun(r.id, { resetPage: false }); }} />
          <RunList selectedId={runId} onSelect={id => { setMessage(null); setRun(id, { resetPage: false }); }} />
        </div>
        {/* On phones the results come first; the settings and earlier runs follow */}
        <div className="order-1 flex min-w-0 flex-col gap-3 xl:order-none">
          {/* Where the data comes from sits right above the results, so a sample-data warning can't be missed */}
          <DataSource />
          {runId && run.isPending && <Skeleton className="h-[28rem] rounded-md" />}
          {run.isError && !isApiError(run.error) && <ErrorState title={en.common.loadFailed} onRetry={() => { void run.refetch(); }} retryLabel={en.common.retry} />}
          {run.isError && isApiError(run.error) && <ErrorState title={run.error.message} onRetry={() => { setRun(null); }} retryLabel={en.common.back} />}
          {run.data && <RunView key={run.data.id} run={run.data} />}
        </div>
      </div>
    </div>
  );
};
export default Shadow;
