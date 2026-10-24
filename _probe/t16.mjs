
import * as I from '../lib/ids.mjs';
const st = I.idStats();
console.log('pending before', st.pending, JSON.stringify(I.listPending()));
for (const p of I.listPending()) I.dismissPending(p.id);
console.log('after', I.idStats().pending);
