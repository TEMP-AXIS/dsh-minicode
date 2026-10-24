import { readFile, readdir } from 'node:fs/promises';
import { parsePage } from './parse.mjs';
const names = (await readdir('_probe/pages')).filter((n) => n.endsWith('.html')).sort();
for (const n of names) {
  const p = '/ugc-wiki/' + n.replace(/__/g, '/');
  const html = await readFile('_probe/pages/' + n, 'utf8');
  const r = parsePage({ path: p, html });
  const c = r.records ? r.records.length : (r.sections ? r.sections.length : 0);
  console.log(String(r.kind).padEnd(6), String(c).padStart(4), p, '|', (r.title || '').slice(0, 30));
}
