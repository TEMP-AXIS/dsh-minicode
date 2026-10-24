
import { syncOfficial } from '../lib/idsource.mjs';
import * as I from '../lib/ids.mjs';
const t0 = Date.now();
const r = await syncOfficial({ log: (l) => console.log('  ' + l) });
console.log(JSON.stringify(r.byKind), 'fetched', r.fetched, 'merged', JSON.stringify(r.merged), 'failures', r.failures.length, (Date.now()-t0)+'ms');
console.log('stats', JSON.stringify(I.idStats()));
console.log('lookup 樱桃木:', JSON.stringify(I.findIds('樱桃木','block')));
console.log('lookup 1001:', JSON.stringify(I.findIds('1001').slice(0,3)));
I.setId({ kind: 'item', name: '樱桃木', value: '999' });
await syncOfficial({});
console.log('player wins after resync:', JSON.stringify(I.findIds('樱桃木','item')));
console.log('total', I.idStats().total);
