import { readFile } from 'node:fs/promises';
import { parseHtml, findEl, findAllEl, hasClass, textOf, clean } from '../lib/html.mjs';
import { parsePage } from './parse.mjs';
const html = await readFile('_probe/pages/apis__actor.html', 'utf8');
const root = parseHtml(html);
const doc = findEl(root, (e) => hasClass(e, 'vp-doc'));
console.log('doc?', !!doc, doc && doc.tag, doc && doc.attrs.class);
if (doc) {
  console.log('kids:', doc.children.length);
  console.log('first 6:', doc.children.slice(0, 6).map((k) => k.tag || ('text:' + String(k.text).slice(0, 20))));
  const tables = findAllEl(doc, (e) => e.tag === 'table');
  console.log('tables:', tables.length);
  if (tables[0]) {
    const th = findAllEl(tables[0], (e) => e.tag === 'th').map((x) => clean(textOf(x)));
    console.log('headers:', th.slice(0, 4));
  }
  console.log('h2s:', findAllEl(doc, (e) => e.tag === 'h2').length);
}
const p = parsePage({ path: '/ugc-wiki/apis/actor.html', html });
console.log('kind:', p.kind, 'records:', p.records ? p.records.length : 0, 'title:', p.title);
