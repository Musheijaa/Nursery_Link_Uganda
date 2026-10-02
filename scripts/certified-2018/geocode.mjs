// Finds each nursery's town on OpenStreetMap (Nominatim) and stores the point in apps/api/src/db/seed/data/certified-nurseries-2018.json.
// One request at a time, 1.1 s apart, with an identifying User-Agent, per Nominatim's usage policy.
// Only rows without a location are looked up, so it can be re-run. Run from the repository root:
//   node scripts/certified-2018/geocode.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../../apps/api/src/db/seed/data/certified-nurseries-2018.json', import.meta.url);
const data = JSON.parse(readFileSync(FILE, 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const search = async q => {
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q, format: 'jsonv2', countrycodes: 'ug', limit: '1' })}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'NurseryLinkUganda/0.1 (one-off import of the 2018 SPGS certified nursery list)' } });
  await sleep(1100);
  if (!res.ok) throw new Error(`Nominatim ${res.status} for ${q}`);
  const [hit] = await res.json();
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon), name: hit.display_name } : null;
};

for (const n of data.nurseries) {
  if (n.location) continue;
  // "Kyabakadde-Kalagi" is a village and its trading centre: try the whole name, then each part
  const parts = n.town.split(/[-,]/).map(p => p.trim()).filter(Boolean);
  const queries = [...new Set([`${n.town}, ${n.district_2018}, Uganda`, ...parts.map(p => `${p}, ${n.district_2018}, Uganda`), ...parts.map(p => `${p}, Uganda`)])];
  for (const q of queries) {
    const hit = await search(q);
    if (hit) {
      n.location = [Math.round(hit.lng * 1e5) / 1e5, Math.round(hit.lat * 1e5) / 1e5];
      n.located_by = `OpenStreetMap: "${q}" → ${hit.name}`;
      break;
    }
  }
  console.log(n.ref, n.town, '→', n.location ?? 'not found');
}
writeFileSync(FILE, `${JSON.stringify(data, null, 1)}\n`);
