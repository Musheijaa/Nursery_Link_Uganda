import { describe, expect, it } from 'vitest';
import { MAX_IMPORT_ROWS, parseInventoryCsv } from './inventoryImport.js';

const N1 = '11111111-1111-4111-8111-111111111111';
const N2 = '22222222-2222-4222-8222-222222222222';
const N3 = '33333333-3333-4333-8333-333333333333';
const lookups = {
  nurseries: [
    { id: N1, name: 'Kasangalabi Tree Nursery' },
    { id: N2, name: 'Twin Nursery' },
    { id: N3, name: 'twin nursery' },
  ],
  species: [{ id: 's-mvule', slug: 'mvule' }, { id: 's-musizi', slug: 'musizi' }],
};

describe('parseInventoryCsv', () => {
  it('accepts nursery ids or names, any header case and order, a BOM and thousands separators', () => {
    const csv = '﻿Unit_Price,Species_Slug,Nursery_Name,Nursery_ID,Quantity\n' +
      `2000,mvule,,${N1},2500\n` +
      '"1,800",MUSIZI,kasangalabi tree nursery,,"12,000"\n';
    const result = parseInventoryCsv(csv, lookups);
    expect(result.errors).toEqual([]);
    expect(result.lines).toEqual([
      { row: 2, nurseryId: N1, nurseryName: 'Kasangalabi Tree Nursery', speciesId: 's-mvule', speciesSlug: 'mvule', quantity: 2500, unitPrice: 2000 },
      { row: 3, nurseryId: N1, nurseryName: 'Kasangalabi Tree Nursery', speciesId: 's-musizi', speciesSlug: 'musizi', quantity: 12000, unitPrice: 1800 },
    ]);
  });

  it('reports every problem with its row and column', () => {
    const csv = 'nursery_id,nursery_name,species_slug,quantity,unit_price\n' +
      'not-a-uuid,,mvule,10,100\n' +
      '99999999-9999-4999-8999-999999999999,,mvule,10,100\n' +
      ',Unknown Nursery,mvule,10,100\n' +
      ',Twin Nursery,mvule,10,100\n' +
      `${N1},,baobab,10,100\n` +
      `${N1},,mvule,-5,0\n` +
      `${N1},,musizi,1.5,abc\n` +
      ',,mvule,10,100\n';
    const { errors, lines } = parseInventoryCsv(csv, lookups);
    expect(lines).toEqual([]);
    expect(errors).toEqual([
      { row: 2, column: 'nursery_id', message: 'Not a valid id' },
      { row: 3, column: 'nursery_id', message: 'No nursery with this id' },
      { row: 4, column: 'nursery_name', message: 'No nursery named "Unknown Nursery"' },
      { row: 5, column: 'nursery_name', message: 'More than one nursery is named "Twin Nursery"; use nursery_id' },
      { row: 6, column: 'species_slug', message: 'Unknown species "baobab"' },
      { row: 7, column: 'quantity', message: 'Use a whole number of seedlings (0 or more)' },
      { row: 7, column: 'unit_price', message: 'Use a whole-shilling price of at least 1' },
      { row: 8, column: 'quantity', message: 'Use a whole number of seedlings (0 or more)' },
      { row: 8, column: 'unit_price', message: 'Use a whole-shilling price of at least 1' },
      { row: 9, column: 'nursery_name', message: 'Give a nursery_id or nursery_name' },
    ]);
  });

  it('flags the same nursery and species twice', () => {
    const csv = `nursery_id,species_slug,quantity,unit_price\n${N1},mvule,1,100\n${N1},mvule,2,100\n`;
    expect(parseInventoryCsv(csv, lookups).errors).toEqual([{ row: 3, message: 'Same nursery and species as row 2' }]);
  });

  it('rejects files with missing columns, no rows, too many rows or broken quoting', () => {
    expect(parseInventoryCsv('species_slug,quantity\nmvule,1\n', lookups).errors.map(e => e.message)).toEqual([
      'Add a nursery_id or nursery_name column', 'Missing column unit_price',
    ]);
    expect(parseInventoryCsv('nursery_id,species_slug,quantity,unit_price\n', lookups).errors[0]?.message).toBe('The file has no data rows');
    const big = `nursery_id,species_slug,quantity,unit_price\n${`${N1},mvule,1,100\n`.repeat(MAX_IMPORT_ROWS + 1)}`;
    expect(parseInventoryCsv(big, lookups).errors[0]?.message).toMatch(/At most 5000 rows/);
    expect(parseInventoryCsv('nursery_id,species_slug,quantity,unit_price\n"unclosed,mvule,1,100\n', lookups).errors[0]?.message).toMatch(/Could not read the CSV/);
  });
});
