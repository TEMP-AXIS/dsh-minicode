// The id registry.
//
// The wiki names hundreds of things by id (道具ID, 方块ID, 特效ID, 音效ID ...) but
// never publishes the numbers, and a 变量ID / 元件ID does not exist until the player
// creates it in the map editor.  So this module keeps two lists:
//   ids     - id values we actually know, from the player (source 'player') or from
//             mining the crawled corpus (source 'harvest');
//   pending - requests for an id nobody could answer.  The agent must never invent a
//             number: it records the request and tells the player to fill it in on the
//             Settings page, and the player's answer lands back in ids.
import { dataFile } from './paths.mjs';
import { readJson, writeJson, nowIso, hashId } from './jsonfile.mjs';

const FILE = 'ids.json';
const MAX_PENDING = 120;
const MAX_ITEMS = 9000;

/* Kinds the player is the only possible source for. */
export const PLAYER_ONLY = ['var', 'comp', 'custom'];

export const KINDS = [
  { kind: 'item', label: '道具ID', playerOnly: false },
  { kind: 'block', label: '方块ID', playerOnly: false },
  { kind: 'effect', label: '特效ID', playerOnly: false },
  { kind: 'sound', label: '音效ID', playerOnly: false },
  { kind: 'creature', label: '生物ID', playerOnly: false },
  { kind: 'particle', label: '粒子特效ID', playerOnly: false },
  { kind: 'buff', label: 'buffID', playerOnly: false },
  { kind: 'act', label: '动作ID', playerOnly: false },
  { kind: 'picture', label: '图片ID', playerOnly: false },
  { kind: 'ui', label: 'UIID / 界面ID', playerOnly: true },
  { kind: 'var', label: '变量ID', playerOnly: true },
  { kind: 'comp', label: '元件ID', playerOnly: true },
  { kind: 'custom', label: '其它自定义ID', playerOnly: true },
];

export function kindLabel(kind) {
  const hit = KINDS.find((entry) => entry.kind === kind);
  return hit ? hit.label : kind;
}

export function isPlayerOnly(kind) {
  return PLAYER_ONLY.includes(kind);
}

let state = null;

function emptyState() {
  return { version: 1, updated: nowIso(), ids: [], pending: [] };
}

function load() {
  if (state) return state;
  const raw = readJson(dataFile(FILE), null);
  state = raw && typeof raw === 'object' ? raw : emptyState();
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!Array.isArray(state.pending)) state.pending = [];
  return state;
}

function save() {
  const s = load();
  s.updated = nowIso();
  writeJson(dataFile(FILE), s);
}

function norm(v) {
  return String(v || '').replace(/\s+/g, ' ').trim();
}

function keyOf(kind, name) {
  return hashId('id|' + kind + '|' + name.toLowerCase());
}

export function listIds(opts) {
  const o = opts || {};
  const s = load();
  let items = s.ids.slice();
  if (o.kind) items = items.filter((item) => item.kind === o.kind);
  const q = norm(o.q).toLowerCase();
  if (q) {
    items = items.filter((item) => {
      const hay = (item.name + ' ' + item.value + ' ' + (item.note || '')).toLowerCase();
      return hay.includes(q);
    });
  }
  items.sort((a, b) => String(a.kind).localeCompare(String(b.kind)) || String(a.name).localeCompare(String(b.name)));
  const limit = Math.max(1, Math.min(500, Number(o.limit) || 200));
  return { items: items.slice(0, limit), total: items.length, pending: s.pending.slice(0, 40) };
}

/** Best matches for a name the agent asked about. Never throws. */
export function findIds(query, kind) {
  try {
    const q = norm(query).toLowerCase();
    if (!q) return [];
    const s = load();
    const scored = [];
    for (const item of s.ids) {
      if (kind && item.kind !== kind) continue;
      const name = String(item.name || '').toLowerCase();
      const value = String(item.value || '').toLowerCase();
      let score = 0;
      if (name === q || value === q) score = 100;
      else if (name.includes(q) || (q.length >= 2 && q.includes(name))) score = 60;
      else if (value.includes(q)) score = 40;
      if (score) scored.push({ item: item, score: score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 8).map((hit) => hit.item);
  } catch {
    return [];
  }
}

export function setId(input) {
  const s = load();
  const kind = norm(input.kind) || 'custom';
  const name = norm(input.name);
  const value = norm(input.value);
  if (!name) throw new Error('id needs a name');
  if (!value) throw new Error('id needs a value');
  const key = keyOf(kind, name);
  const now = nowIso();
  const existing = s.ids.find((item) => item.key === key);
  if (existing) {
    existing.value = value;
    existing.note = norm(input.note) || existing.note;
    existing.source = norm(input.source) || 'player';
    existing.updated = now;
    save();
    return existing;
  }
  const item = {
    key: key,
    kind: kind,
    name: name,
    value: value,
    note: norm(input.note),
    source: norm(input.source) || 'player',
    created: now,
    updated: now,
  };
  s.ids.unshift(item);
  if (s.ids.length > MAX_ITEMS) s.ids.length = MAX_ITEMS;
  /* answering a request resolves it */
  s.pending = s.pending.filter((p) => !(p.kind === kind && String(p.name).toLowerCase() === name.toLowerCase()));
  save();
  return item;
}

export function removeId(key) {
  const s = load();
  const before = s.ids.length;
  s.ids = s.ids.filter((item) => item.key !== String(key));
  if (s.ids.length === before) return false;
  save();
  return true;
}

/** Merge ids mined from the corpus; player-entered values always win. */
export function harvestIds(list) {
  const s = load();
  let added = 0;
  let skipped = 0;
  for (const raw of Array.isArray(list) ? list : []) {
    const kind = norm(raw.kind) || 'custom';
    const name = norm(raw.name);
    const value = norm(raw.value);
    if (!name || !value) continue;
    const key = keyOf(kind, name);
    const existing = s.ids.find((item) => item.key === key);
    if (existing) {
      if (existing.source === 'harvest' && existing.value !== value) {
        existing.value = value;
        existing.updated = nowIso();
        added++;
      } else {
        skipped++;
      }
      continue;
    }
    s.ids.push({
      key: key,
      kind: kind,
      name: name,
      value: value,
      note: norm(raw.note),
      source: 'harvest',
      created: nowIso(),
      updated: nowIso(),
    });
    added++;
  }
  if (s.ids.length > MAX_ITEMS) s.ids.length = MAX_ITEMS;
  if (added || skipped) save();
  return { added: added, skipped: skipped, total: s.ids.length };
}

/**
 * Bulk import from an authoritative table (the official id tables).
 * The import replaces every entry of the same source, so a name that vanished
 * upstream disappears here too, and a value the player typed always wins.
 */
export function importIds(list, opts) {
  const o = opts || {};
  const source = norm(o.source) || 'official';
  const s = load();
  const now = nowIso();
  if (o.replace !== false) s.ids = s.ids.filter((item) => item.source !== source);
  const playerNames = new Set();
  for (const item of s.ids) {
    if (item.source === 'player') playerNames.add(item.kind + '|' + String(item.name).toLowerCase());
  }
  const index = new Map();
  for (const item of s.ids) index.set(item.kind + '|' + String(item.name).toLowerCase(), item);
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const raw of Array.isArray(list) ? list : []) {
    const kind = norm(raw.kind) || 'custom';
    const name = norm(raw.name);
    const value = norm(raw.value);
    if (!name || !value) continue;
    const nameKey = kind + '|' + name.toLowerCase();
    if (playerNames.has(nameKey)) {
      skipped += 1;
      continue;
    }
    const existing = index.get(nameKey);
    if (existing) {
      if (existing.value !== value) {
        existing.value = value;
        existing.updated = now;
        updated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }
    const item = {
      key: hashId('id|' + kind + '|' + nameKey + '|' + value),
      kind: kind,
      name: name,
      value: value,
      note: norm(raw.note),
      source: source,
      created: now,
      updated: now,
    };
    index.set(nameKey, item);
    s.ids.push(item);
    added += 1;
  }
  if (s.ids.length > MAX_ITEMS) s.ids.length = MAX_ITEMS;
  save();
  return { added: added, updated: updated, skipped: skipped, total: s.ids.length, source: source };
}

/** Record that an id is needed but unknown, so the player can fill it in. */
export function requestId(input) {
  const s = load();
  const kind = norm(input.kind) || 'custom';
  const name = norm(input.name);
  if (!name) throw new Error('request needs a name');
  const existing = s.pending.find((p) => p.kind === kind && String(p.name).toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.count = (existing.count || 0) + 1;
    existing.at = nowIso();
    existing.hint = norm(input.hint) || existing.hint;
    save();
    return existing;
  }
  const item = {
    id: hashId('req|' + kind + '|' + name.toLowerCase()),
    kind: kind,
    name: name,
    hint: norm(input.hint),
    count: 1,
    at: nowIso(),
  };
  s.pending.unshift(item);
  if (s.pending.length > MAX_PENDING) s.pending.length = MAX_PENDING;
  save();
  return item;
}

export function listPending() {
  return load().pending.slice();
}

export function dismissPending(id) {
  const s = load();
  const before = s.pending.length;
  s.pending = s.pending.filter((p) => p.id !== String(id));
  if (s.pending.length === before) return false;
  save();
  return true;
}

export function idStats() {
  const s = load();
  const byKind = {};
  for (const item of s.ids) byKind[item.kind] = (byKind[item.kind] || 0) + 1;
  const bySource = {};
  for (const item of s.ids) bySource[item.source || 'player'] = (bySource[item.source || 'player'] || 0) + 1;
  return {
    total: s.ids.length,
    player: s.ids.filter((i) => i.source === 'player').length,
    harvest: s.ids.filter((i) => i.source === 'harvest').length,
    official: s.ids.filter((i) => i.source === 'official').length,
    pending: s.pending.length,
    byKind: byKind,
    bySource: bySource,
    updated: s.updated,
  };
}

export function resetIds() {
  state = null;
}