import { isApiError } from '@nurserylink/api-client';
import { Badge, Button, cn, formatCount, formatUGX, toast } from '@nurserylink/ui';
import { Download, FileUp } from 'lucide-react';
import { useState } from 'react';
import { en } from '../../copy/en';
import { useImportCsv, type ImportResult } from './api';

const TEMPLATE = 'nursery_name,species_slug,quantity,unit_price\nMukono Town Nursery,mvule,1200,1800\n';

const downloadTemplate = () => {
  const url = URL.createObjectURL(new Blob(['﻿', TEMPLATE], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'nursery-stock-template.csv';
  a.click();
  URL.revokeObjectURL(url);
};

const pair = (p: { quantity_available: number; unit_price: number } | null) => (p ? `${formatCount(p.quantity_available)} @ ${formatUGX(p.unit_price)}` : '—');

/** CSV import: check the file (dry run), see every change and every problem, then commit. */
export const CsvImport = () => {
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const run = useImportCsv();

  const check = (text: string) => {
    run.mutate({ csv: text, commit: false }, {
      onSuccess: setResult,
      onError: err => {
        // Row errors come back as a 400 carrying the full dry-run result
        const details = isApiError(err) ? (err.details as ImportResult | undefined) : undefined;
        if (details && Array.isArray(details.errors)) setResult(details);
        else toast.error(isApiError(err) ? err.message : en.common.loadFailed);
      },
    });
  };

  const changes = result ? result.summary.create + result.summary.update : 0;
  return (
    <section aria-labelledby="import" className="flex flex-col gap-3 rounded-lg bg-paper shadow-card p-4 ring-1 ring-line">
      <h2 id="import" className="text-lg">{en.inventory.importTitle}</h2>
      <p className="text-sm text-bark-muted">{en.inventory.importIntro}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={downloadTemplate}><Download aria-hidden />{en.inventory.template}</Button>
        <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-sm bg-forest px-3 text-sm font-bold text-paper hover:bg-canopy">
          <FileUp aria-hidden className="size-4" />
          {en.inventory.chooseFile}
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              void file.text().then(text => {
                setFileName(file.name);
                setCsv(text);
                setResult(null);
                check(text);
              });
            }}
          />
        </label>
        {fileName && <span className="text-sm">{fileName}</span>}
      </div>

      {result && (
        <div className="flex flex-col gap-2">
          <h3 className="text-base">{en.inventory.previewHeading}</h3>
          <p className="text-sm">{en.inventory.summary(result.summary.create, result.summary.update, result.summary.unchanged)}</p>
          {result.errors.length > 0 && <p role="alert" className="rounded-sm bg-laterite-tint px-3 py-2 text-sm font-bold text-laterite">{en.inventory.rowErrors(result.errors.length)}</p>}
          <div className="max-h-96 overflow-auto rounded-sm ring-1 ring-line">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-sand">
                <tr>{[en.inventory.row, en.inventory.action, en.inventory.columns.species, en.inventory.before, en.inventory.after].map(h => <th key={h} scope="col" className="h-8 border-b border-line px-2 text-left">{h}</th>)}</tr>
              </thead>
              <tbody>
                {result.errors.map(e => (
                  <tr key={`e${String(e.row)}${e.column ?? ''}`} className="bg-laterite-tint/50">
                    <td className="border-b border-line px-2">{e.row}</td>
                    <td className="border-b border-line px-2"><Badge tone="danger">{en.inventory.problem}</Badge></td>
                    <td colSpan={3} className="border-b border-line px-2 text-laterite">{e.column ? `${e.column}: ` : ''}{e.message}</td>
                  </tr>
                ))}
                {result.changes.map(c => (
                  <tr key={`c${String(c.row)}`} className={cn(c.action === 'unchanged' && 'text-bark-muted')}>
                    <td className="border-b border-line px-2">{c.row}</td>
                    <td className="border-b border-line px-2"><Badge tone={c.action === 'create' ? 'positive' : c.action === 'update' ? 'info' : 'neutral'}>{en.inventory.actions[c.action]}</Badge></td>
                    <td className="border-b border-line px-2">{c.nursery} · {c.species}</td>
                    <td className="border-b border-line px-2 tabular-nums">{pair(c.before)}</td>
                    <td className="border-b border-line px-2 tabular-nums">{pair(c.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.committed ? (
            <p role="status" className="font-bold text-seedling">{en.inventory.committed(changes)}</p>
          ) : result.errors.length > 0 ? null : changes === 0 ? (
            <p>{en.inventory.nothingToApply}</p>
          ) : (
            <Button
              className="self-start"
              disabled={!csv}
              busy={run.isPending}
              onClick={() => {
                if (!csv) return;
                run.mutate({ csv, commit: true }, { onSuccess: r => { setResult(r); toast.success(en.inventory.committed(r.summary.create + r.summary.update)); }, onError: err => { toast.error(isApiError(err) ? err.message : en.common.loadFailed); } });
              }}
            >
              {en.inventory.commit(changes)}
            </Button>
          )}
        </div>
      )}
    </section>
  );
};
