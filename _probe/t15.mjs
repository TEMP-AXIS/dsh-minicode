
import { apply } from '../index.js';
import { updateConfig } from '../lib/config.mjs';
const defs = new Map();
apply({ tools: { register: (d) => defs.set(d.name, d) } });
const call = async (name, args) => {
  const d = defs.get(name);
  const out = await d.execute(args, {});
  return d.output.render(args, out)[0].text;
};
console.log('== ids lookup 樱桃木');
console.log((await call('ugc_ids', { action: 'lookup', kind: 'block', name: '樱桃木' })).split('\n').slice(0, 3).join('\n'));
console.log('== ids lookup 变量 (unknown)');
console.log((await call('ugc_ids', { action: 'lookup', kind: 'var', name: '回合数' })).split('\n').slice(0, 2).join('\n'));
console.log('== status tail');
console.log((await call('ugc_status', {})).split('\n').slice(-2).join('\n'));
console.log('== guide auto lines');
const guide = await call('ugc_guide', {});
console.log(guide.split('\n').filter((l) => l.indexOf('自动') >= 0).join('\n'));
updateConfig({ autoMemory: false, autoTemplates: false });
const g2 = await call('ugc_guide', {});
console.log('-- after turning both off:');
console.log(g2.split('\n').filter((l) => l.indexOf('自动') >= 0).join('\n'));
updateConfig({ autoMemory: true, autoTemplates: true });
console.log('restored', JSON.stringify((await import('../lib/config.mjs')).getConfig()));
