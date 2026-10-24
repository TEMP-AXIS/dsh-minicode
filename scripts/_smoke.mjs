import { apply } from '../index.js';

const defs = new Map();
apply({ tools: { register: (def) => defs.set(def.name, def) } });

const cases = [
  ['ugc_status', {}],
  ['ugc_guide', {}],
  ['ugc_search', { q: 'GetItemId' }],
  ['ugc_search', { q: '获取坐标', limit: 5 }],
  ['ugc_search', { q: 'SetTeam', kind: 'api' }],
  ['ugc_api', { id: 'actor:setteam' }],
  ['ugc_api', { id: 'SetTeam' }],
  ['ugc_api', { id: 'GetAttr' }],
  ['ugc_module', { module: 'Actor' }],
  ['ugc_module', { module: 'nope' }],
  ['ugc_event', { q: '进入游戏' }],
  ['ugc_event', { name: 'ObjectEvent.PlayerEnterGame' }],
  ['ugc_event', {}],
  ['ugc_enum', { name: '游戏模式' }],
  ['ugc_enum', { q: 'WorldType' }],
  ['ugc_enum', {}],
  ['ugc_doc', { page: 'introduction/componentapi' }],
  ['ugc_doc', { page: 'quickin/iteminst', section: '道具' }],
  ['ugc_pack', { task: '玩家进入区域时给队伍加buff并弹出提示' }],
  ['ugc_pack', { task: 'spawn a monster and play animation', budget: 800 }],
  ['ugc_template', { action: 'list' }],
  ['ugc_template', { action: 'get', id: 'slider' }],
  ['ugc_memory', { action: 'list' }],
  ['ugc_memory', { action: 'delete', id: 'builtin:clone-element' }],
];

const missing = ['ugc_search', 'ugc_api', 'ugc_module', 'ugc_event', 'ugc_enum', 'ugc_doc', 'ugc_pack', 'ugc_status', 'ugc_guide'].filter((n) => !defs.has(n));
console.log('registered', defs.size, missing.length ? 'MISSING ' + missing.join(',') : 'all present');

for (const [name, args] of cases) {
  const def = defs.get(name);
  let out;
  try {
    out = await def.execute(args, {});
  } catch (err) {
    console.log('!! ' + name + ' ' + JSON.stringify(args) + ' threw: ' + err.message);
    continue;
  }
  const text = def.output.render(args, out)[0].text;
  const lines = text.split('\n');
  console.log('== ' + name + ' ' + JSON.stringify(args) + ' -> ' + text.length + ' chars, ' + lines.length + ' lines');
  console.log(lines.slice(0, 6).map((l) => '   ' + (l.length > 120 ? l.slice(0, 120) + '…' : l)).join('\n'));
}
