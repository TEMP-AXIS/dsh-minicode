import http from 'node:http';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const TMP = fileURLToPath(new URL('./e2e3', import.meta.url));
rmSync(TMP, { recursive: true, force: true });
process.env.DSH_UGC_DATA_DIR = TMP;
const { createApi, PREFIX } = await import('../lib/api.mjs');
const paths = await import('../lib/paths.mjs');
const index = JSON.parse(readFileSync(new URL('../data/ugc-wiki.json', import.meta.url), 'utf8'));
const deps = { indexInfo: () => ({ path: 'b', source: 'bundled', meta: index.meta, bytes: 1, pages: 40, index }), reloadStore: () => {}, dataDir: () => paths.dataDir(), cacheDir: fileURLToPath(new URL('./pages', import.meta.url)), homeFile: fileURLToPath(new URL('./home.html', import.meta.url)), log: (l) => console.log('log:', l) };
const handle = createApi(deps);
const server = http.createServer((req, res) => (String(req.url).startsWith(PREFIX) ? handle(req, res) : (res.statusCode = 404, res.end())));
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;
const hit = (p, init) => fetch(base + PREFIX + p, init).then((r) => r.json());
await hit('/crawl', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'live' }) });
let state = 'running';
for (let i = 0; i < 200 && state === 'running'; i++) {
  await new Promise((r) => setTimeout(r, 250));
  state = (await hit('/crawl')).crawl.state;
}
const final = (await hit('/crawl')).crawl;
console.log('LIVE:', JSON.stringify({ state: final.state, done: final.done, total: final.total, message: final.message, counts: final.counts, failures: final.failures }));
server.close();
process.exit(final.state === 'done' ? 0 : 1);
