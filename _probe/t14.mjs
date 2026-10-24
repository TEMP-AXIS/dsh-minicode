
import { readFileSync, existsSync } from 'node:fs';
import * as I from '../lib/ids.mjs';
import { getConfig } from '../lib/config.mjs';
import { dataDir } from '../lib/paths.mjs';
console.log('real data dir:', dataDir());
const store = JSON.parse(readFileSync(dataDir() + '/ids.json', 'utf8'));
const players = store.ids.filter((i) => i.source === 'player');
console.log('player entries:', JSON.stringify(players));
for (const p of players) I.removeId(p.key);
console.log('after cleanup', JSON.stringify(I.idStats()));
console.log('config', JSON.stringify(getConfig()));
console.log('files', existsSync(dataDir() + '/config.json'));
