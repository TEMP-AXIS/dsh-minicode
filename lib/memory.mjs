// Memory of the mistakes that keep coming back.
//
// The wiki documents what the engine can do; it cannot document what this player's
// project got wrong.  Two kinds of records live here:
//   items  - an explicit correction the agent (or the user) recorded: a topic, what
//            was wrong, and the fact that replaces it.  Surfaced by ugc_search and
//            ugc_pack, and printed by ugc_guide when pinned.
//   misses - queries no lookup could answer, recorded automatically.  They are the
//            evidence the Settings page shows so the user can turn a recurring miss
//            into a correction.
//
// builtin/memory/*.json is the part that ships with the plugin: corrections learned from real
// project scripts (the ui-clone / ui-slider traps above all).  They behave like
// built-in templates - always matched, never deleted - so a fresh install already
// knows the traps without the user retyping them.
import { builtinMemory } from './builtin.mjs';
import { dataFile } from './paths.mjs';
import { readJson, writeJson, nowIso, hashId } from './jsonfile.mjs';

const FILE = 'memory.json';
const MAX_ITEMS = 400;
const MAX_MISSES = 80;
/** The shipped corrections, in the same record shape as stored items. */
function seeds() {
  return builtinMemory().map((item) => Object.assign({}, item));
}

let state = null;

function emptyState() {
  return { version: 1, updated: nowIso(), items: [], misses: [] };
}

function load() {
  if (state) return state;
  const raw = readJson(dataFile(FILE), null);
  state = raw && typeof raw === 'object' ? raw : emptyState();
  if (!Array.isArray(state.items)) state.items = [];
  if (!Array.isArray(state.misses)) state.misses = [];
  return state;
}

function save() {
  const s = load();
  s.updated = nowIso();
  writeJson(dataFile(FILE), s);
}

function norm(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function tagsOf(value) {
  if (Array.isArray(value)) return value.map(norm).filter(Boolean).slice(0, 8);
  return String(value || '')
    .split(/[,，\s]+/)
    .map(norm)
    .filter(Boolean)
    .slice(0, 8);
}

/** Split a query into lowercase match tokens; CJK contributes 2-grams too. */
function tokensOf(query) {
  const out = new Set();
  const text = String(query || '').toLowerCase();
  for (const part of text.split(/\s+/)) {
    if (!part) continue;
    out.add(part);
    if (/[\u3400-\u9fff]/.test(part) && part.length > 2) {
      for (let i = 0; i + 2 <= part.length; i++) out.add(part.slice(i, i + 2));
    }
  }
  return [...out].filter((t) => t.length >= 2);
}

function scoreOf(item, tokens) {
  const topic = String(item.topic || '').toLowerCase();
  const wrong = String(item.wrong || '').toLowerCase();
  const right = String(item.right || '').toLowerCase();
  const tags = (item.tags || []).join(' ').toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (topic.includes(token)) score += 6;
    else if (tags.includes(token)) score += 4;
    else if (right.includes(token)) score += 3;
    else if (wrong.includes(token)) score += 2;
  }
  return score;
}

export function listMemory(opts) {
  const o = opts || {};
  const s = load();
  let items = seeds().concat(s.items);
  const q = norm(o.q);
  if (q) {
    const tokens = tokensOf(q);
    items = items.filter((item) => scoreOf(item, tokens) > 0);
  }
  items.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.hits || 0) - (a.hits || 0) || String(b.updated).localeCompare(String(a.updated)));
  const limit = Math.max(1, Math.min(200, Number(o.limit) || 60));
  return { items: items.slice(0, limit), total: items.length, misses: s.misses.slice(0, 40) };
}

export function addMemory(input) {
  const s = load();
  const topic = norm(input.topic);
  const right = norm(input.right);
  if (!topic && !right) throw new Error('memory needs topic or right');
  const key = hashId(topic.toLowerCase() + '|' + right.toLowerCase());
  const existing = s.items.find((item) => item.id === key);
  if (existing) {
    existing.wrong = norm(input.wrong) || existing.wrong;
    existing.right = right || existing.right;
    existing.tags = tagsOf(input.tags).length ? tagsOf(input.tags) : existing.tags;
    existing.updated = nowIso();
    save();
    return existing;
  }
  const item = {
    id: key,
    topic: topic,
    wrong: norm(input.wrong),
    right: right,
    tags: tagsOf(input.tags),
    created: nowIso(),
    updated: nowIso(),
    hits: 0,
    pinned: input.pinned === true,
  };
  s.items.unshift(item);
  if (s.items.length > MAX_ITEMS) s.items.length = MAX_ITEMS;
  save();
  return item;
}

export function removeMemory(id) {
  const s = load();
  const before = s.items.length;
  s.items = s.items.filter((item) => item.id !== String(id));
  if (s.items.length === before) return false;
  save();
  return true;
}

export function pinMemory(id, pinned) {
  const s = load();
  const item = s.items.find((entry) => entry.id === String(id));
  if (!item) return null;
  item.pinned = pinned !== false;
  item.updated = nowIso();
  save();
  return item;
}

/** Memory items relevant to a query, best first. Never throws. */
export function matchMemory(query, limit) {
  try {
    const tokens = tokensOf(query);
    if (!tokens.length) return [];
    const s = load();
    const scored = [];
    for (const item of seeds().concat(s.items)) {
      const score = scoreOf(item, tokens);
      if (score > 0) scored.push({ item: item, score: score + (item.pinned ? 4 : 0) });
    }
    scored.sort((a, b) => b.score - a.score || (b.item.pinned ? 1 : 0) - (a.item.pinned ? 1 : 0));
    const picked = scored.slice(0, Math.max(1, Math.min(5, Number(limit) || 3))).map((hit) => hit.item);
    if (picked.some((item) => !item.builtin)) {
      for (const item of picked) {
        if (item.builtin) continue;
        item.hits = (item.hits || 0) + 1;
      }
      save();
    }
    return picked;
  } catch {
    return [];
  }
}

export function pinnedMemory(limit) {
  const s = load();
  return seeds().concat(s.items).filter((item) => item.pinned).slice(0, Math.max(1, Math.min(12, Number(limit) || 6)));
}

/** Remember a query that matched nothing, so Settings can show it. */
export function recordMiss(query, kind) {
  try {
    const q = norm(query);
    if (!q || q.length < 2) return;
    const s = load();
    const key = q.toLowerCase();
    const hit = s.misses.find((entry) => String(entry.q).toLowerCase() === key && entry.kind === (kind || 'any'));
    if (hit) {
      hit.count = (hit.count || 0) + 1;
      hit.at = nowIso();
    } else {
      s.misses.unshift({ q: q, kind: kind || 'any', count: 1, at: nowIso() });
      if (s.misses.length > MAX_MISSES) s.misses.length = MAX_MISSES;
    }
    save();
  } catch {
    /* a miss log must never break a lookup */
  }
}

export function clearMisses() {
  const s = load();
  s.misses = [];
  save();
}

export function removeMiss(query, kind) {
  const s = load();
  const key = norm(query).toLowerCase();
  const before = s.misses.length;
  s.misses = s.misses.filter((entry) => !(String(entry.q).toLowerCase() === key && (!kind || entry.kind === kind)));
  if (s.misses.length === before) return false;
  save();
  return true;
}

export function memoryStats() {
  const s = load();
  return {
    items: s.items.length,
    builtin: builtinMemory().length,
    pinned: seeds().concat(s.items).filter((i) => i.pinned).length,
    misses: s.misses.length,
    updated: s.updated,
  };
}

/** Tests only: drop the in-memory copy so the next read hits disk. */
export function resetMemory() {
  state = null;
}