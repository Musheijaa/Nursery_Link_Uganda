// Fails the build when the JavaScript needed for first load grows past the budget
// (docs/design-plan.md: initial JS under 200 KB gzipped). First load = the entry chunk and every
// chunk it imports statically; lazily loaded route chunks (dynamic imports) are not counted.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 200;
const dist = new URL('../dist/', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(join(dist, '.vite/manifest.json'), 'utf8'));

const entry = Object.values(manifest).find(chunk => chunk.isEntry);
if (!entry) throw new Error('No entry chunk in the Vite manifest; run `vite build` first');

const seen = new Set();
const visit = key => {
  if (seen.has(key)) return;
  seen.add(key);
  for (const imported of manifest[key]?.imports ?? []) visit(imported);
};
visit(Object.keys(manifest).find(key => manifest[key] === entry));

let total = 0;
const rows = [];
for (const key of seen) {
  const file = manifest[key].file;
  if (!file.endsWith('.js')) continue;
  const kb = gzipSync(readFileSync(join(dist, file)), { level: 9 }).length / 1024;
  total += kb;
  rows.push([file, kb]);
}
rows.sort((a, b) => b[1] - a[1]);
for (const [file, kb] of rows) console.log(`${kb.toFixed(1).padStart(7)} KB  ${file}`);
console.log(`${total.toFixed(1).padStart(7)} KB  initial JS (gzip), budget ${BUDGET_KB} KB`);
if (total > BUDGET_KB) {
  console.error(`Initial JavaScript is over budget by ${(total - BUDGET_KB).toFixed(1)} KB`);
  process.exit(1);
}
