import { parse } from 'csv-parse/sync';

/** One validated line from an inventory CSV. */
export interface ImportLine {
  row: number;
  nurseryId: string;
  nurseryName: string;
  speciesId: string;
  speciesSlug: string;
  quantity: number;
  unitPrice: number;
}

export interface ImportError {
  /** Line number in the file, counting the header as line 1 */
  row: number;
  column?: string;
  message: string;
}

export const MAX_IMPORT_ROWS = 5000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WHOLE_NUMBER = /^\d{1,9}$/;

/**
 * Parses and validates an inventory CSV against known nurseries and species. Pure: no database
 * access, so it is unit-tested directly. Columns (case-insensitive, any order):
 *   nursery_id or nursery_name, species_slug, quantity, unit_price
 */
export const parseInventoryCsv = (
  csv: string,
  lookups: { nurseries: { id: string; name: string }[]; species: { id: string; slug: string }[] }
): { lines: ImportLine[]; errors: ImportError[]; rowCount: number } => {
  let records: Record<string, string>[];
  try {
    records = parse(csv, {
      columns: (header: string[]) => header.map(h => h.trim().toLowerCase()),
      bom: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
    });
  } catch (err) {
    return { lines: [], errors: [{ row: 0, message: `Could not read the CSV: ${err instanceof Error ? err.message : String(err)}` }], rowCount: 0 };
  }

  const first = records[0];
  const headerErrors: ImportError[] = [];
  if (!first) return { lines: [], errors: [{ row: 0, message: 'The file has no data rows' }], rowCount: 0 };
  const columns = Object.keys(first);
  if (!columns.includes('nursery_id') && !columns.includes('nursery_name')) headerErrors.push({ row: 1, message: 'Add a nursery_id or nursery_name column' });
  for (const col of ['species_slug', 'quantity', 'unit_price']) {
    if (!columns.includes(col)) headerErrors.push({ row: 1, column: col, message: `Missing column ${col}` });
  }
  if (headerErrors.length) return { lines: [], errors: headerErrors, rowCount: records.length };
  if (records.length > MAX_IMPORT_ROWS) {
    return { lines: [], errors: [{ row: 0, message: `At most ${String(MAX_IMPORT_ROWS)} rows per import` }], rowCount: records.length };
  }

  const nurseriesById = new Map(lookups.nurseries.map(n => [n.id, n]));
  const nurseriesByName = new Map<string, { id: string; name: string }[]>();
  for (const n of lookups.nurseries) {
    const key = n.name.trim().toLowerCase();
    nurseriesByName.set(key, [...(nurseriesByName.get(key) ?? []), n]);
  }
  const speciesBySlug = new Map(lookups.species.map(s => [s.slug, s]));

  const lines: ImportLine[] = [];
  const errors: ImportError[] = [];
  const seen = new Map<string, number>();

  records.forEach((record, index) => {
    const row = index + 2;
    const rowErrors: ImportError[] = [];

    let nursery: { id: string; name: string } | undefined;
    const idCell = record.nursery_id ?? '';
    const nameCell = record.nursery_name ?? '';
    if (idCell) {
      if (!UUID.test(idCell)) rowErrors.push({ row, column: 'nursery_id', message: 'Not a valid id' });
      else if (!(nursery = nurseriesById.get(idCell.toLowerCase()))) rowErrors.push({ row, column: 'nursery_id', message: 'No nursery with this id' });
    } else if (nameCell) {
      const matches = nurseriesByName.get(nameCell.toLowerCase()) ?? [];
      if (matches.length === 0) rowErrors.push({ row, column: 'nursery_name', message: `No nursery named "${nameCell}"` });
      else if (matches.length > 1) rowErrors.push({ row, column: 'nursery_name', message: `More than one nursery is named "${nameCell}"; use nursery_id` });
      else nursery = matches[0];
    } else {
      rowErrors.push({ row, column: 'nursery_name', message: 'Give a nursery_id or nursery_name' });
    }

    const slug = (record.species_slug ?? '').toLowerCase();
    const species = speciesBySlug.get(slug);
    if (!species) rowErrors.push({ row, column: 'species_slug', message: slug ? `Unknown species "${slug}"` : 'Give a species_slug' });

    const quantityCell = (record.quantity ?? '').replace(/,/g, '');
    const priceCell = (record.unit_price ?? '').replace(/,/g, '');
    if (!WHOLE_NUMBER.test(quantityCell)) rowErrors.push({ row, column: 'quantity', message: 'Use a whole number of seedlings (0 or more)' });
    if (!WHOLE_NUMBER.test(priceCell) || Number(priceCell) < 1) rowErrors.push({ row, column: 'unit_price', message: 'Use a whole-shilling price of at least 1' });

    if (nursery && species) {
      const key = `${nursery.id}:${species.id}`;
      const earlier = seen.get(key);
      if (earlier !== undefined) rowErrors.push({ row, message: `Same nursery and species as row ${String(earlier)}` });
      else seen.set(key, row);
    }

    if (rowErrors.length || !nursery || !species) {
      errors.push(...rowErrors);
      return;
    }
    lines.push({
      row,
      nurseryId: nursery.id,
      nurseryName: nursery.name,
      speciesId: species.id,
      speciesSlug: species.slug,
      quantity: Number(quantityCell),
      unitPrice: Number(priceCell),
    });
  });

  return { lines, errors, rowCount: records.length };
};
