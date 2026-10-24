
import { seedFromBundle } from '../lib/idsource.mjs';
import * as I from '../lib/ids.mjs';
const t0 = Date.now();
const r = seedFromBundle();
console.log('seeded', JSON.stringify(r && { seeded: r.seeded, total: r.merged.total, added: r.merged.added }));
console.log('second call (should be null):', seedFromBundle());
console.log('stats', JSON.stringify(I.idStats()));
console.log('lookup 石头/樱桃木:', JSON.stringify(I.findIds('樱桃木','block').slice(0,2)));
console.log('lookup 1001:', I.findIds('1001').map((x)=>x.kind+'='+x.value+'/'+x.name).slice(0,3));
console.log('ms', Date.now()-t0);
