
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { syncOfficial, TABLES } from '../lib/idsource.mjs';
import { dataFile } from '../lib/paths.mjs';

const r = await syncOfficial({});
const store = JSON.parse(readFileSync(dataFile('ids.json'), 'utf8'));
const groups = {};
for (const table of TABLES) groups[table.kind] = {};
const counts = {};
for (const item of store.ids) {
  if (item.source !== 'official') continue;
  if (!groups[item.kind]) groups[item.kind] = {};
  groups[item.kind][item.name] = Number(item.value);
  counts[item.kind] = (counts[item.kind] || 0) + 1;
}
const payload = { source: 'https://developers.mini1.cn/wiki/data_files/', builtAt: new Date().toISOString(), counts: counts, groups: groups };
const text = JSON.stringify(payload);
const out = fileURLToPath(new URL('../data/official-ids.json', import.meta.url));
writeFileSync(out, text);
console.log('tables', JSON.stringify(r.byKind), 'failures', r.failures.length);
console.log('entries', store.ids.length, 'counts', JSON.stringify(counts));
console.log('wrote', text.length, 'chars');
