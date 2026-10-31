// The bundled id tables.
//
// dev-wiki.mini1.cn publishes the script API but never an id table. The tables
// we ship (data/official-ids.json) are built ahead of time by
// scripts/import-sjy.mjs from community-maintained id dumps and merged with the
// older official block/item/creature snapshot. Nothing here touches the network:
// the plugin only ever reads the shipped snapshot.
import * as I from './ids.mjs';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Shipped snapshot of the same tables (data/official-ids.json), so a fresh
// install answers id lookups without touching the network.
const BUNDLED_IDS = fileURLToPath(new URL('../data/official-ids.json', import.meta.url));

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
      entries.push({ kind: kind, name: name, value: String(names[name]), note: '内置ID表' });
    }
  }
  if (!entries.length) return null;
  const merged = I.importIds(entries, { source: 'official' });
  return { seeded: entries.length, merged: merged, builtAt: payload.builtAt || '' };
}
