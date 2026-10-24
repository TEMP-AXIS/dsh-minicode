
import { createApi } from '../lib/api.mjs';
import * as I from '../lib/ids.mjs';

function call(handler, method, url, body) {
  return new Promise((resolve, reject) => {
    const req = { method, url, on: null, [Symbol.asyncIterator]: undefined };
    if (body !== undefined) {
      const buf = Buffer.from(JSON.stringify(body));
      let sent = false;
      req.on = (ev, cb) => { if (ev === 'data') cb(buf); if (ev === 'end') cb(); return req; };
    }
    const chunks = [];
    const res = {
      statusCode: 200,
      headers: {},
      setHeader: (k, v) => { res.headers[k] = v; },
      writeHead: (code) => { res.statusCode = code; return res; },
      write: (c) => { chunks.push(String(c)); return true; },
      end: (c) => { if (c) chunks.push(String(c)); resolve({ code: res.statusCode, body: chunks.join('') }); return res; },
    };
    handler(req, res).catch(reject);
  });
}

function deps() {
  const info = { path: 'bundled', source: 'bundled', meta: { builtAt: '', wikiUpdated: '', counts: {} }, bytes: 1, pages: 1 };
  return { indexInfo: () => info, reloadStore: () => {}, dataDir: () => process.env.DSH_UGC_DATA_DIR || '.', cacheDir: '../_probe/pages', homeFile: '../_probe/home.html', log: () => {} };
}

const h = createApi(deps());
const s0 = await call(h, 'GET', '/ugc-wiki/api/settings');
console.log('settings GET', s0.code, s0.body);
const s1 = await call(h, 'POST', '/ugc-wiki/api/settings', { autoMemory: false });
console.log('settings POST', s1.code, s1.body);
const s2 = await call(h, 'GET', '/ugc-wiki/api/settings');
console.log('settings GET again', s2.body);
await call(h, 'POST', '/ugc-wiki/api/settings', { autoMemory: true });

const st = await call(h, 'GET', '/ugc-wiki/api/status');
const stp = JSON.parse(st.body);
console.log('status has', Object.keys(stp).join(','), '| config', JSON.stringify(stp.config), '| official.state', stp.official.state);

const start = await call(h, 'POST', '/ugc-wiki/api/ids', { action: 'sync-official' });
console.log('sync start', start.code, start.body.slice(0, 160));
let last = '';
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  const p = await call(h, 'GET', '/ugc-wiki/api/ids?q=');
  const j = JSON.parse(p.body);
  last = j.sync.state + ' ' + j.sync.done + '/' + j.sync.total + ' ' + j.sync.message + ' total=' + j.stats.total + ' official=' + j.stats.official;
  if (j.sync.state !== 'running') break;
}
console.log('sync final:', last);
const dup = await call(h, 'POST', '/ugc-wiki/api/ids', { action: 'sync-official' });
console.log('second sync (should be fine, sequential):', dup.code);
