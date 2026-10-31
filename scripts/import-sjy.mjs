// Import the complete sjy1218 id tables into data/official-ids.json.
//
// Upstream publishes one JSON per id space at
//   https://operatecdn.sjy1218.com/ALLIDS/<file>.json
// each shaped { "<id>": "<name>" }.
//
// Nothing is filtered on purpose: the registry keeps every id the game actually
// has, including test blocks, placeholder rows and reserved ranges, so a lookup
// never comes back empty because of a build-time policy call. Pass --skip-notes
// if you do want the "151200-151299树苗" range-description rows dropped.
//
// Usage: node scripts/import-sjy.mjs [--dir <folder with the 13 json files>] [--skip-notes]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = ROOT + 'data/official-ids.json';

const argv = process.argv.slice(2);
const dirAt = argv.indexOf('--dir');
const SRC = dirAt >= 0 ? argv[dirAt + 1] : 'C:/Users/mi/Desktop/modle/data/sjy';
const SKIP_NOTES = argv.includes('--skip-notes');
const RANGE_NOTE = /^\d+\s*-\s*\d+/;

// file -> kind. Several files can feed one kind; the first one that defines a
// name wins, so the specific tables stay ahead of the catch-all ones.
const MAP = [
  { file: 'new', kind: 'item', label: '新增道具表' },
  { file: 'itemid', kind: 'item', label: '道具/方块ID表' },
  { file: 'actor', kind: 'creature', label: '生物表' },
  { file: 'buffid', kind: 'buff', label: '状态表' },
  { file: 'buff_customize', kind: 'buff', label: '自定义状态表' },
  { file: 'effectid', kind: 'effect', label: '特效表' },
  { file: 'action', kind: 'act', label: '动作表' },
  { file: 'enchantid', kind: 'enchant', label: '附魔表' },
  { file: 'modelid', kind: 'model', label: '模型表' },
  { file: 'skin', kind: 'skin', label: '皮肤表' },
  { file: 'horseskills', kind: 'skill', label: '坐骑技能表' },
  { file: 'spellenhancementdef_map', kind: 'spell', label: '法术强化表' },
  { file: 'spellgenerationdef_map', kind: 'spell', label: '法术生成表' },
];

function clean(name) {
  return String(name == null ? '' : name).replace(/\s+/g, ' ').trim();
}

function readTable(file) {
  const path = SRC + '/' + file + '.json';
  if (!existsSync(path)) return null;
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.error('skip ' + file + ': ' + String(err && err.message ? err.message : err));
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const rows = [];
  for (const key of Object.keys(raw)) {
    if (!/^\d+$/.test(key)) continue;
    const name = clean(raw[key]);
    if (!name) continue;
    if (SKIP_NOTES && RANGE_NOTE.test(name)) continue;
    rows.push({ id: Number(key), name: name });
  }
  rows.sort((a, b) => a.id - b.id);
  return rows;
}

const previous = (() => {
  try {
    return JSON.parse(readFileSync(OUT, 'utf8'));
  } catch {
    return null;
  }
})();

const groups = {};
const labels = {};
const counts = {};
const files = {};

function add(kind, label, name, id) {
  if (!groups[kind]) groups[kind] = {};
  if (Object.prototype.hasOwnProperty.call(groups[kind], name)) return false;
  groups[kind][name] = id;
  if (!labels[kind]) labels[kind] = label;
  return true;
}

// 1. Carry over the tables sjy1218 does not publish (block / picture / sound /
//    particle come from developers.mini1.cn data_files).
const CARRY = ['block', 'picture', 'sound', 'particle'];
if (previous && previous.groups) {
  for (const kind of CARRY) {
    const table = previous.groups[kind] || {};
    for (const name of Object.keys(table)) {
      const id = String(table[name]);
      if (!/^\d+$/.test(id)) continue;
      add(kind, (previous.labels && previous.labels[kind]) || kind, name, Number(id));
    }
    files[kind] = Object.keys(table).length;
  }
}

// 2. Everything sjy1218 publishes, unfiltered.
for (const entry of MAP) {
  const rows = readTable(entry.file);
  if (!rows) {
    console.error('missing table ' + entry.file + '.json');
    continue;
  }
  let added = 0;
  for (const row of rows) {
    if (add(entry.kind, entry.label, row.name, row.id)) added += 1;
  }
  files[entry.file] = rows.length;
  console.error(entry.file + ': ' + rows.length + ' rows, ' + added + ' new names -> ' + entry.kind);
}

// 3. The itemid table also names the blocks; keep block/ item consistent by
//    letting the upstream name win over the older mirror.
const itemNames = groups.item || {};
for (const name of Object.keys(groups.block || {})) {
  if (Object.prototype.hasOwnProperty.call(itemNames, name)) {
    groups.block[name] = itemNames[name];
  }
}

for (const kind of Object.keys(groups)) counts[kind] = Object.keys(groups[kind]).length;

const payload = {
  source: 'https://operatecdn.sjy1218.com/ALLIDS/ (sjy1218 id tables, unfiltered) + developers.mini1.cn/wiki/data_files (block/picture/sound/particle)',
  builtAt: new Date().toISOString(),
  note: SKIP_NOTES ? 'range-description rows dropped' : 'unfiltered: reserved ranges, placeholders and test rows are kept',
  counts: counts,
  files: files,
  labels: labels,
  groups: groups,
};

writeFileSync(OUT, JSON.stringify(payload));
const total = Object.keys(counts).reduce((sum, kind) => sum + counts[kind], 0);
console.log('wrote ' + OUT);
console.log('total names ' + total + ' over ' + Object.keys(counts).length + ' kinds');
console.log(JSON.stringify(counts, null, 2));
