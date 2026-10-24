// User-facing on/off switches for the two "the AI maintains this by itself"
// features, plus the id-table sync.  Everything defaults to ON: the point of
// the switches is to let the player stop the agent from writing into the
// registries, not to make them a required setup step.
import { dataFile } from './paths.mjs';
import { readJson, writeJson, nowIso } from './jsonfile.mjs';

const FILE = 'config.json';

const DEFAULTS = {
  autoMemory: true, // agent records its own mistakes as memory items
  autoTemplates: true, // agent saves the scripts it writes as templates
  autoIds: true, // crawling also refreshes the official id tables
  autoUpdate: true, // ask GitHub for a newer version (at most once per 6 h)
  version: 1,
};

let cache = null;

function load() {
  if (cache) return cache;
  const raw = readJson(dataFile(FILE), null);
  cache = Object.assign({}, DEFAULTS, raw && typeof raw === 'object' ? raw : {});
  for (const key of ['autoMemory', 'autoTemplates', 'autoIds', 'autoUpdate']) {
    cache[key] = cache[key] !== false;
  }
  return cache;
}

export function getConfig() {
  const c = load();
  return {
    autoMemory: c.autoMemory,
    autoTemplates: c.autoTemplates,
    autoIds: c.autoIds,
    autoUpdate: c.autoUpdate,
    updated: c.updated || '',
  };
}

export function updateConfig(patch) {
  const c = load();
  let changed = false;
  for (const key of ['autoMemory', 'autoTemplates', 'autoIds', 'autoUpdate']) {
    if (patch && typeof patch[key] === 'boolean' && c[key] !== patch[key]) {
      c[key] = patch[key];
      changed = true;
    }
  }
  if (changed) {
    c.updated = nowIso();
    c.version = 1;
    writeJson(dataFile(FILE), c);
  }
  return getConfig();
}

export function resetConfig() {
  cache = null;
}
