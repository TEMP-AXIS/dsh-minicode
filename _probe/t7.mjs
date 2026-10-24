import http from 'node:http';
import { rmSync } from 'node:fs';
import { createHarness } from './harness.mjs';

const TMP = new URL('./e2e', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
rmSync(TMP, { recursive: true, force: true });
process.env.DSH_UGC_DATA_DIR = TMP;

const { createApi, PREFIX } = await import('../lib/api.mjs');
const paths = await import('../lib/paths.mjs');
const { readFileSync } = await import('node:fs');

const index = JSON.parse(readFileSync(new URL('../data/ugc-wiki.json', import.meta.url), 'utf8'));

const deps = {
  indexInfo: () => ({ path: 'bundled:data/ugc-wiki.json', source: 'bundled', meta: index.meta, bytes: 708000, pages: index.meta.counts.pages, index }),
  reloadStore: () => {},
  dataDir: () => paths.dataDir(),
  cacheDir: new URL('../_probe/pages', import.meta.url).pathname,
  homeFile: new URL('../_probe/home.html', import.meta.url).pathname,
  log: () => {},
};

const handle = createApi(deps);
const server = http.createServer((req, res) => {
  if (String(req.url).startsWith(PREFIX)) return handle(req, res);
  res.statusCode = 404;
  res.end('nope');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
console.log('server on', base);

const seen = [];
const harness = createHarness((url, init) => { seen.push(String((init && init.method) || 'GET') + ' ' + url); return fetch(base + url, init); });
let failures = 0;
async function settle(ms) {
  await new Promise((r) => setTimeout(r, ms || 400));
  await harness.render();
}

function check(name, cond, extra) {
  if (cond) console.log('  ok   ' + name);
  else { failures++; console.log('  FAIL ' + name + (extra ? ' :: ' + extra : '')); }
}

// 1. index tab with the real bundled index
let passes = await harness.mount(harness.module.Section, { close: () => {} });
let dump = harness.dump();
check('index tab renders counts', dump.indexOf('571 个函数') >= 0, dump.slice(0, 200));
check('index tab shows builtin source', dump.indexOf('插件内置') >= 0);

// 2. memory: add through the form
await harness.click('memory');
await harness.type(0, 'SetTeam 参数顺序');
await harness.type(1, '第一个参数传 objid');
await harness.type(2, 'Actor:SetTeam(teamId, objid)');
await harness.type(3, 'team 队伍');
await harness.click('记住这一条');
await settle();
dump = harness.dump();
check('memory added via form', dump.indexOf('SetTeam 参数顺序') >= 0, dump.slice(0, 300));
const memoryFile = JSON.parse((await import('node:fs')).readFileSync(paths.dataFile('memory.json'), 'utf8'));
check('memory.json has one item', memoryFile.items.length === 1, JSON.stringify(memoryFile).slice(0, 200));

// 3. templates: open a builtin and save a copy
await harness.click('templates');
const viewButtons = harness.buttons().filter((b) => b === '查看/编辑');
check('template list has builtins', viewButtons.length >= 6, String(viewButtons.length));
await harness.click('查看/编辑');
await settle();
dump = harness.dump();
const area = harness.inputs().filter((node) => node.type === 'textarea')[0];
check('builtin source loaded', Boolean(area) && String(area.props.value).indexOf('local Script') >= 0, area ? String(area.props.value).slice(0, 80) : 'no textarea');
check('builtin offers 另存为副本', harness.buttons().indexOf('另存为副本') >= 0, harness.buttons().join(','));
await harness.click('另存为副本');
await settle();
const templatesFile = JSON.parse((await import('node:fs')).readFileSync(paths.dataFile('templates.json'), 'utf8'));
check('template copy saved', (templatesFile.items || []).length === 1, JSON.stringify(Object.keys(templatesFile)));

// 4. ids: player fills a number
await harness.click('ids');
await harness.type(0, '星星');
await harness.type(1, '1001');
await harness.type(2, '主界面道具');
await harness.click('登记');
await settle();
dump = harness.dump();
check('id registered via form', dump.indexOf('星星 = 1001') >= 0, dump.slice(0, 400));

// 5. ids: a lookup miss creates a pending request the player can answer
const post = await fetch(base + PREFIX + '/ids', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'request', kind: 'var', name: '计分板' }) });
console.log('  request POST', post.status, (await post.text()).slice(0, 200));
const idsGet = await fetch(base + PREFIX + '/ids').then((r) => r.json());
console.log('  ids GET pending', JSON.stringify(idsGet.pending));
await harness.click('memory');
await harness.click('ids');
await settle();
dump = harness.dump();
check('pending request shown', dump.indexOf('计分板') >= 0, dump.slice(0, 500));

const pendingInput = harness.inputs().length;
console.log('  (inputs on ids tab: ' + pendingInput + ')');
// the pending row's 数值 field is the last input before its 保存 button; fill by position
await harness.type(pendingInput - 2, '77');
await harness.click('保存');
await settle();
dump = harness.dump();
check('pending answered', dump.indexOf('计分板 = 77') >= 0, dump.slice(0, 600));

// 6. status endpoint shape matches what the page reads
const status = await (await fetch(base + PREFIX + '/status')).json();
check('status.index.counts.apis', status.index && status.index.counts && status.index.counts.apis === 571, JSON.stringify(status.index && status.index.counts));
check('status.crawl.state', status.crawl && typeof status.crawl.state === 'string');

console.log('fetch log:', [...new Set(seen)].join(' ; '));
console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
server.close();
process.exit(failures === 0 ? 0 : 1);