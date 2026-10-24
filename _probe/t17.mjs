// Update-check test: cache-only GET, then a forced POST that talks to GitHub.
import { createApi } from '../lib/api.mjs';
import { updateInfo, localVersion, compareVersions } from '../lib/update.mjs';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = path.join(os.tmpdir(), 'ugc-upd-' + Date.now());
mkdirSync(tmp, { recursive: true });
process.env.DSH_UGC_DATA_DIR = tmp;

function call(handler, method, url, body) {
  return new Promise((resolve, reject) => {
    const req = { method, url };
    if (body !== undefined) {
      const buf = Buffer.from(JSON.stringify(body));
      req.on = (ev, cb) => { if (ev === 'data') cb(buf); if (ev === 'end') cb(); return req; };
    }
    const chunks = [];
    const res = {
      statusCode: 200,
      setHeader: () => {},
      writeHead: (code) => { res.statusCode = code; return res; },
      write: (c) => { chunks.push(String(c)); return true; },
      end: (c) => { if (c) chunks.push(String(c)); resolve({ code: res.statusCode, body: chunks.join('') }); return res; },
    };
    handler(req, res).catch(reject);
  });
}

const deps = {
  indexInfo: () => ({ path: 'bundled', source: 'bundled', meta: { builtAt: '', wikiUpdated: '', counts: {} }, bytes: 1, pages: 1 }),
  reloadStore: () => {},
  dataDir: () => tmp,
  cacheDir: '',
  homeFile: '',
  log: () => {},
};
const api = createApi(deps);

console.log('local version', localVersion());
console.log('compare 0.2.0 > 0.1.0 ->', compareVersions('0.2.0', '0.1.0'), '| 0.1.0 > 0.2.0 ->', compareVersions('0.1.0', '0.2.0'));

const before = updateInfo();
console.log('before any check:', JSON.stringify({ local: before.local, stale: before.stale, latest: before.latest, newer: before.newer }));

const g1 = await call(api, 'GET', '/ugc-wiki/api/update');
console.log('GET /update', g1.code, g1.body.slice(0, 240));

console.log('POST /update (live, may take a few seconds) ...');
const p1 = await call(api, 'POST', '/ugc-wiki/api/update', { force: true });
const body = JSON.parse(p1.body);
const u = body.update || {};
console.log('POST /update', p1.code, JSON.stringify({ local: u.local, latest: u.latest, newer: u.newer, stars: u.stars, issues: u.issues, error: u.error }));
console.log('cache file written:', existsSync(path.join(tmp, 'update.json')));

const g2 = await call(api, 'GET', '/ugc-wiki/api/update');
console.log('GET /update again cached ->', JSON.parse(g2.body).update.checkedAt);

const st = await call(api, 'GET', '/ugc-wiki/api/status');
const stp = JSON.parse(st.body);
console.log('status keys:', Object.keys(stp).join(','), '| status.update.local', stp.update && stp.update.local);
