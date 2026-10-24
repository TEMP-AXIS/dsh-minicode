
import { writeFileSync } from 'node:fs';
const BASE = 'https://developers.mini1.cn/wiki/data_files/';
const FILES = {
  block: 'blockdef.html', item: 'itemdef.html', creature: 'monster.html',
  particle: 'particles.html', sound: 'Sound.html', buff: 'buffdef.html',
  act: 'triggeract.html', ui: 'DevUIResource.html',
};
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
function parse(html) {
  const pairs = [];
  const tables = html.split(/<table/i).slice(1);
  for (const t of tables) {
    const body = t.split(/<\/table>/i)[0];
    for (const rowM of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...rowM[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => strip(m[1]));
      for (let i = 0; i + 1 < cells.length; i += 2) {
        const a = cells[i], b = cells[i + 1];
        if (/^\d{1,7}$/.test(a) && b && b.length <= 40) pairs.push({ value: Number(a), name: b });
      }
    }
  }
  return pairs;
}
const out = {};
for (const [kind, file] of Object.entries(FILES)) {
  const url = BASE + file;
  const res = await fetch(url);
  const html = await res.text();
  const p = parse(html);
  out[kind] = p;
  const names = p.slice(0, 6).map(x => x.name + '=' + x.value).join(', ');
  console.log(kind, res.status, html.length, 'pairs=' + p.length, '|', names);
}
writeFileSync('_probe/iddata.json', JSON.stringify(out, null, 0));
