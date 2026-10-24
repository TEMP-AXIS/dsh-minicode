import http from 'node:http';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TMP = fileURLToPath(new URL('./e2e2', import.meta.url));
rmSync(TMP, { recursive: true, force: true });
process.env.DSH_UGC_DATA_DIR = TMP;

const { createApi, PREFIX } = await import('../lib/api.mjs');
const paths = await import('../lib/paths.mjs');
const index = JSON.parse(readFileSync(new URL('../data/ugc-wiki.json', import.meta.url), 'utf8'));

let reloaded = 0;
const deps = {
  indexInfo: () => ({ path: 'bundled', source: 'bundled', meta: index.meta, bytes: 1, pages: 40, index }),
  reloadStore: () => { reloaded += 1; },
  dataDir: () => paths.dataDir(),
  cacheDir: fileURLToPath(new URL('./pages', import.meta.url)),
  homeFile: fileURLToPath(new URL('./home.html', import.meta.url)),
  log: () => {},
};
const handle = createApi(deps);
const server = http.createServer((req, res) => (String(req.url).startsWith(PREFIX) ? handle(req, res) : (res.statusCode = 404, res.end())));
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;
const hit = (path, init) => fetch(base + PREFIX + path, init).then((r) => r.json());

const started = await hit('/crawl', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'offline' }) });
console.log('start:', started.crawl.state);
let state = started.crawl.state;
for (let i = 0; i < 80 && state === 'running'; i++) {
  await new Promise((r) => setTimeout(r, 150));
  const poll = await hit('/crawl');
  state = poll.crawl.state;
  if (i % 5 === 0) console.log('  poll', state, poll.crawl.done + '/' + poll.crawl.total, poll.crawl.message);
}
const final = await hit('/crawl');
console.log('final:', JSON.stringify({ state: final.crawl.state, done: final.crawl.done, total: final.crawl.total, message: final.crawl.message, counts: final.crawl.counts, failures: final.crawl.failures.length }));
console.log('reloadStore calls:', reloaded);
const written = paths.crawledIndexFile();
console.log('index.json written:', existsSync(written), written);
if (existsSync(written)) {
  const data = JSON.parse(readFileSync(written, 'utf8'));
  console.log('written counts:', JSON.stringify(data.meta.counts));
}
const status = await hit('/status');
console.log('status source:', status.index.source, 'path:', status.index.path);
server.close();
process.exit(final.crawl.state === 'done' && existsSync(written) ? 0 : 1);
