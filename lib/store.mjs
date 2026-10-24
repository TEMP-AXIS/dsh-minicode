// In-memory index over the prebuilt MiniWorld UGC wiki JSON.
// No dependencies: the index ships with the bundle, so lookups are a few
// microseconds and nothing is fetched at answer time.
import { readFileSync } from 'node:fs';

const CJK = /[\u3400-\u9fff]/;

function haystack(rec) {
  if (rec._h) return rec._h;
  const parts = [rec.name || '', rec.module || '', rec.moduleCn || '', rec.desc || '', rec.sig || ''];
  if (rec.params) for (const p of rec.params) parts.push(p.name || '', p.type || '', p.desc || '');
  if (rec.note) parts.push(rec.note);
  rec._h = parts.join(' ').toLowerCase();
  return rec._h;
}

/** Words of a CamelCase record name, cached: PlayAnim -> ['play','anim']. */
function nameWords(rec) {
  if (rec._w) return rec._w;
  rec._w = String(rec.name || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
  return rec._w;
}

/**
 * Match a query token against one CamelCase word of a name. 2 = same word,
 * 1 = morphological prefix hit ("animation" -> "anim", "spawn" -> "spawn…"),
 * 0 = no hit. Short words such as "get"/"set" are deliberately not used as
 * prefixes: they would drag in every Get* function.
 */
function wordHit(w, token) {
  if (w === token) return 2;
  if (token.length >= 3 && w.length >= 4 && token.startsWith(w)) return 1;
  if (token.length >= 4 && w.startsWith(token)) return 1;
  return 0;
}

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were', 'will', 'can', 'should', 'would', 'not', 'but', 'all', 'any', 'how', 'when', 'into', 'its', 'her', 'our', 'their', 'you', 'your']);

function words(task) {
  const out = new Set();
  const ascii = String(task || '').match(/[A-Za-z_][A-Za-z0-9_]{1,}/g) || [];
  for (const w of ascii) {
    const lower = w.toLowerCase();
    if (lower.length < 3 || STOPWORDS.has(lower)) continue;
    out.add(lower);
  }
  const cjkRuns = String(task || '').match(/[\u3400-\u9fff]{2,}/g) || [];
  for (const run of cjkRuns) {
    out.add(run);
    for (let len = Math.min(4, run.length); len >= 2; len--) {
      for (let i = 0; i + len <= run.length; i++) out.add(run.slice(i, i + len));
    }
  }
  return [...out].filter((w) => w.length >= 2);
}

/**
 * Split a query into match tokens. Latin queries stay whole words; a CJK run
 * also contributes its 2-grams so "获取坐标" still finds "获取对象坐标".
 */
function tokensOf(raw) {
  const out = [];
  for (const part of String(raw || '').toLowerCase().split(/\s+/)) {
    if (!part) continue;
    out.push(part);
    if (CJK.test(part) && part.length > 2) {
      for (let i = 0; i + 2 <= part.length; i++) out.push(part.slice(i, i + 2));
    }
  }
  return out;
}

/** Load one JSON index file and prepare the lookup maps. */
export function loadStore(file) {
  const raw = readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  const store = {
    file: file,
    bytes: raw.length,
    meta: data.meta || {},
    modules: data.modules || [],
    apis: data.apis || [],
    events: data.events || [],
    enums: data.enums || [],
    docs: data.docs || [],
    pages: data.pages || [],
    byId: new Map(),
    apiByName: new Map(),
    eventByName: new Map(),
    docByKey: new Map(),
    enumValues: [],
  };
  for (const rec of store.apis) {
    store.byId.set(rec.id, rec);
    const key = String(rec.name).toLowerCase();
    if (!store.apiByName.has(key)) store.apiByName.set(key, []);
    store.apiByName.get(key).push(rec);
  }
  for (const rec of store.events) {
    store.byId.set(rec.id, rec);
    const key = String(rec.name).toLowerCase();
    if (!store.eventByName.has(key)) store.eventByName.set(key, []);
    store.eventByName.get(key).push(rec);
  }
  for (const page of store.docs) {
    const key = page.page.replace(/^\/ugc-wiki\//, '').replace(/\.html$/, '').toLowerCase();
    store.docByKey.set(key, page);
    store.docByKey.set(page.page.toLowerCase(), page);
    if (page.title) store.docByKey.set(String(page.title).toLowerCase(), page);
  }
  for (const group of store.enums) {
    for (const value of group.values) store.enumValues.push({ group: group, value: value });
  }
  return store;
}

export function moduleOf(store, name) {
  if (!name) return null;
  const q = String(name).trim().toLowerCase();
  const byKey = store.modules.find((m) => m.module === q);
  if (byKey) return byKey;
  const byRecv = store.modules.find((m) => String(m.receiver).toLowerCase() === q);
  if (byRecv) return byRecv;
  const loose = store.modules.find((m) => m.module.includes(q) || String(m.receiver).toLowerCase().includes(q) || m.moduleCn.includes(name));
  return loose || null;
}

function scoreApi(rec, q) {
  const name = String(rec.name).toLowerCase();
  const id = String(rec.id).toLowerCase();
  const desc = String(rec.desc || '');
  const moduleCn = String(rec.moduleCn || '');
  const module = String(rec.module || '');
  if (q === id || q === name) return 1000;
  if (q === id.replace(':', '.') || q === module + '.' + name || q === module + ':' + name) return 980;
  if (name === q) return 900;
  if (name.startsWith(q)) return 780;
  if (name.includes(q)) return 620;
  if (id.includes(q)) return 560;
  // CamelCase words: "animation" reaches PlayAnim, "spawn" reaches CanMobSpawnOnPosXZ.
  for (const w of nameWords(rec)) {
    const hit = wordHit(w, q);
    if (hit === 2) return 500;
    if (hit === 1) return 360;
  }
  if (desc.includes(q)) return 420;
  if (moduleCn.includes(q)) return 300;
  if (module === q) return 260;
  if (String(rec.sig || '').toLowerCase().includes(q)) return 240;
  if (haystack(rec).includes(q)) return 120;
  return 0;
}

/** Inverse document frequency per token: rare words dominate ranking. */
function idfOf(pool, tokens) {
  const df = new Map();
  for (const token of tokens) {
    let n = 0;
    for (const rec of pool) if (haystack(rec).includes(token)) n++;
    df.set(token, Math.log(1 + pool.length / (1 + n)));
  }
  return df;
}

/** Rank one record against weighted tokens; shared by search and packing. */
function rankRecord(rec, tokens, df, bases, raw) {
  const hay = haystack(rec);
  let score = 0;
  let matched = 0;
  for (const token of tokens) {
    const base = bases(rec, token);
    if (!base) continue;
    matched++;
    score += base * (df.get(token) || 1);
  }
  if (!matched) return 0;
  if (raw && hay.includes(raw)) score += 800;
  score += 100 * (matched - 1);
  return score;
}

/**
 * Drop tail hits that only matched a common token, so the reported total is the
 * number of plausible answers rather than every record sharing one word.
 */
function cutRelative(scored, ratio) {
  if (scored.length < 2) return scored;
  const floor = scored[0].score * (ratio || 0.12);
  const kept = scored.filter((h) => h.score >= floor);
  return kept.length ? kept : scored.slice(0, 1);
}

/**
 * Rank API functions for a free-form query. Latin names score highest, CJK
 * prose matches are weighted by rarity so "获取坐标" ranks 坐标 hits above the
 * thousands of unrelated 获取 functions.
 */
export function searchApis(store, query, opts) {
  const options = opts || {};
  const raw = String(query || '').trim().toLowerCase();
  const tokens = [...new Set(tokensOf(raw))];
  if (!tokens.length) return [];
  const only = options.module ? moduleOf(store, options.module) : null;
  const pool = only ? store.apis.filter((r) => r.module === only.module) : store.apis;
  const df = idfOf(pool, tokens);
  const scored = [];
  for (const rec of pool) {
    const score = rankRecord(rec, tokens, df, scoreApi, raw);
    if (score > 0) scored.push({ rec: rec, score: score });
  }
  scored.sort((a, b) => b.score - a.score || a.rec.id.localeCompare(b.rec.id));
  return cutRelative(scored, 0.12);
}

/** Rank API functions (or another record list) for a bag of task keywords. */
export function rankByTerms(store, terms, records) {
  const list = records || store.apis;
  const tokens = [...new Set(terms)].slice(0, 40);
  if (!tokens.length) return [];
  const df = idfOf(list, tokens);
  const bases = (rec, token) => {
    if (rec.kind === 'event') return scoreEvent(rec, token) / 8;
    const name = String(rec.name).toLowerCase();
    const desc = String(rec.desc || '') + ' ' + String(rec.note || '');
    let base = 0;
    if (name === token) base = 150;
    else if (name.includes(token)) base = 90;
    if (desc.includes(token)) base = Math.max(base, 32);
    if (String(rec.module || '').includes(token) || String(rec.moduleCn || '').includes(token)) base = Math.max(base, 30);
    // English morphology: "animation" should still reach PlayAnim, and
    // "monster" should reach AddMonster even when the whole token is absent.
    for (const w of nameWords(rec)) {
      const hit = wordHit(w, token);
      if (hit === 2) base = Math.max(base, 120);
      else if (hit === 1) base = Math.max(base, 70);
    }
    return base;
  };
  const scored = [];
  for (const rec of list) {
    const score = rankRecord(rec, tokens, df, bases, '');
    if (score > 0) scored.push({ rec: rec, score: score });
  }
  scored.sort((a, b) => b.score - a.score || a.rec.id.localeCompare(b.rec.id));
  return scored;
}

/** Score one event token: exact/prefix name hits beat prose hits. */
function scoreEvent(rec, token) {
  const name = String(rec.name).toLowerCase();
  if (name === token) return 900;
  if (name.includes(token)) return 700;
  for (const w of nameWords(rec)) if (wordHit(w, token) === 2) return 450;
  if (String(rec.desc || '').toLowerCase().includes(token)) return 500;
  if (haystack(rec).includes(token)) return 200;
  return 0;
}

export function searchEvents(store, query, opts) {
  const options = opts || {};
  const raw = String(query || '').trim().toLowerCase();
  const tokens = [...new Set(tokensOf(raw))];
  if (!tokens.length) {
    const all = store.events.map((rec) => ({ rec: rec, score: 1 }));
    all.sort((a, b) => a.rec.name.localeCompare(b.rec.name));
    return all;
  }
  const df = idfOf(store.events, tokens);
  const scored = [];
  for (const rec of store.events) {
    const score = rankRecord(rec, tokens, df, scoreEvent, raw);
    if (score > 0) scored.push({ rec: rec, score: score });
  }
  scored.sort((a, b) => b.score - a.score || a.rec.name.localeCompare(b.rec.name));
  return cutRelative(scored, 0.12);
}

export function searchEnums(store, query) {
  const q = String(query || '').trim().toLowerCase();
  const out = [];
  for (const group of store.enums) {
    const groupHit = group.name.toLowerCase().includes(q) || group.values.some((v) => v.name.toLowerCase().includes(q));
    if (!groupHit) continue;
    const values = group.values.filter((v) => v.name.toLowerCase().includes(q) || (v.desc || '').toLowerCase().includes(q));
    out.push({ group: group, values: values.length ? values : group.values, matched: values.length });
  }
  out.sort((a, b) => b.matched - a.matched);
  return out;
}

export function findDoc(store, page) {
  if (!page) return null;
  const key = String(page).trim().toLowerCase();
  const direct = store.docByKey.get(key)
    || store.docByKey.get(key.replace(/^\/ugc-wiki\//, '').replace(/\.html$/, ''));
  if (direct) return direct;
  const loose = store.docs.find((d) => d.page.toLowerCase().includes(key) || String(d.title || '').toLowerCase().includes(key) || String(d.title || '').includes(page));
  return loose || null;
}

/** Keywords for context packing: task words plus the modules they name. */
export function taskTerms(store, task) {
  const terms = words(task);
  const picked = new Set();
  for (const mod of store.modules) {
    const recv = String(mod.receiver || '').toLowerCase();
    if (!recv) continue;
    if (terms.includes(recv) || terms.includes(mod.module) || String(task).includes(mod.moduleCn)) picked.add(mod.module);
  }
  return { terms: terms, modules: [...picked] };
}
