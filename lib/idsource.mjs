// Official id tables from the older documentation site.
//
// dev-wiki.mini1.cn publishes the script API but never an id table; the sibling
// site developers.mini1.cn/wiki still serves the real thing under data_files/:
// eight pages of "ID 名字" pairs (方块 道具 生物 特效 音效 状态 动作 图片库).
// This module downloads those pages and turns them into registry entries; it is
// the only automatic id source we could find that is officially published.
import { fetchText } from './crawl.mjs';
import * as I from './ids.mjs';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const OFFICIAL_BASE = 'https://developers.mini1.cn/wiki/data_files/';

// Shipped snapshot of the same tables (data/official-ids.json), so a fresh
// install answers id lookups without touching the network.
const BUNDLED_IDS = fileURLToPath(new URL('../data/official-ids.json', import.meta.url));

export const TABLES = [
  { kind: 'block', file: 'blockdef.html', label: '方块表' },
  { kind: 'item', file: 'itemdef.html', label: '道具表' },
  { kind: 'creature', file: 'monster.html', label: '生物表' },
  { kind: 'particle', file: 'particles.html', label: '特效表' },
  { kind: 'sound', file: 'Sound.html', label: '音效表' },
  { kind: 'buff', file: 'buffdef.html', label: '状态表' },
  { kind: 'act', file: 'triggeract.html', label: '动作表' },
  { kind: 'picture', file: 'DevUIResource.html', label: '图片库' },
];

function strip(html) {
  return String(html)
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pull "id, name" pairs out of every table row.  The tables are laid out as
 * repeated (id, name) column pairs — a block row holds up to four of them — so
 * the row is walked two cells at a time rather than by column position.
 */
export function parseTables(html) {
  const pairs = [];
  const chunks = String(html).split(/<table/i).slice(1);
  for (const chunk of chunks) {
    const body = chunk.split(/<\/table>/i)[0];
    for (const row of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => strip(m[1]));
      for (let i = 0; i + 1 < cells.length; i += 2) {
        const id = cells[i];
        const name = cells[i + 1];
        if (!/^\d{1,7}$/.test(id)) continue;
        if (!name || name.length > 40 || /^\d+$/.test(name)) continue;
        pairs.push({ value: Number(id), name: name });
      }
    }
  }
  return pairs;
}

/**
 * Download every official table and merge the pairs into the id registry.
 * Entries land with source 'official' and never overwrite a player value.
 */
/** Load the shipped snapshot into an empty registry. Returns null when it is not needed. */
export function seedFromBundle() {
  if (I.idStats().official > 0) return null;
  let payload;
  try {
    payload = JSON.parse(readFileSync(BUNDLED_IDS, 'utf8'));
  } catch {
    return null;
  }
  const entries = [];
  const groups = payload.groups || {};
  for (const kind of Object.keys(groups)) {
    const names = groups[kind] || {};
    for (const name of Object.keys(names)) {
      entries.push({ kind: kind, name: name, value: String(names[name]), note: '官方ID表快照' });
    }
  }
  if (!entries.length) return null;
  const merged = I.importIds(entries, { source: 'official' });
  return { seeded: entries.length, merged: merged, builtAt: payload.builtAt || '' };
}

export async function syncOfficial(opts) {
  const o = opts || {};
  const log = typeof o.log === 'function' ? o.log : () => {};
  const entries = [];
  const byKind = {};
  const failures = [];
  let done = 0;
  for (const table of TABLES) {
    if (o.signal && o.signal.aborted) break;
    const url = OFFICIAL_BASE + table.file;
    try {
      const html = await fetchText(url, { tries: 2, timeoutMs: 30000, signal: o.signal });
      const pairs = parseTables(html);
      for (const pair of pairs) {
        entries.push({ kind: table.kind, name: pair.name, value: String(pair.value), note: table.label });
      }
      byKind[table.kind] = pairs.length;
      log('id table ' + table.file + ': ' + pairs.length + ' entries');
    } catch (err) {
      const message = String(err && err.message ? err.message : err);
      failures.push({ url: url, error: message });
      log('id table failed ' + table.file + ': ' + message);
    }
    done += 1;
    if (typeof o.onProgress === 'function') o.onProgress({ done: done, total: TABLES.length, file: table.file });
  }
  const merged = I.importIds(entries, { source: 'official' });
  return { fetched: entries.length, byKind: byKind, merged: merged, failures: failures };
}
