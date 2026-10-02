import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './exports.service.js';

describe('CSV output', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('Seeta Fruit & Tree Seedlings')).toBe('Seeta Fruit & Tree Seedlings');
    expect(csvCell('Nama, Mukono')).toBe('"Nama, Mukono"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(2500)).toBe('2500');
  });

  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell('+256700100101')).toBe("'+256700100101");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('joins rows with CRLF', () => {
    expect(toCsv(['a', 'b'], [[1, 'x,y']])).toBe('a,b\r\n1,"x,y"\r\n');
  });
});
