// Boot hook test: autoUpdate on -> apply() starts a background GitHub check and
// traces it to DSH_UGC_DEBUG.  Uses a throwaway data dir.
import { apply } from '../index.js';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = path.join(os.tmpdir(), 'ugc-boot-' + Date.now());
mkdirSync(tmp, { recursive: true });
const trace = path.join(tmp, 'trace.log');
process.env.DSH_UGC_DATA_DIR = tmp;
process.env.DSH_UGC_DEBUG = trace;

const defs = new Map();
apply({ tools: { register: (def) => defs.set(def.name, def) } });
console.log('tools registered:', defs.size);

await new Promise((r) => setTimeout(r, 12000));
const log = existsSync(trace) ? readFileSync(trace, 'utf8').trim() : '(no trace)';
console.log('trace:\n' + log);
const upd = existsSync(path.join(tmp, 'update.json')) ? JSON.parse(readFileSync(path.join(tmp, 'update.json'), 'utf8')) : null;
console.log('cached update state:', JSON.stringify({ local: upd && upd.local, latest: upd && upd.latest, newer: upd && upd.newer, error: upd && upd.error }));

const st = defs.get('ugc_status');
const out = await st.execute({}, {});
console.log('-- ugc_status --');
console.log(st.output.render({}, out)[0].text.split('\n').slice(-3).join('\n'));
