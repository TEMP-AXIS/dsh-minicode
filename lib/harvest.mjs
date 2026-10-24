// Mine the crawled corpus for concrete ids.
//
// The wiki never publishes an id table, so the only ids it actually states are the
// ones quoted inside sentences such as '将方块ID为1的替换为2' or '376 是方块ID'.  This
// module extracts exactly those, and separately counts how often each kind of id is
// *mentioned* - that number is what the Settings page shows to explain why most ids
// have to come from the player.

const KIND_WORDS = [
  { kind: 'item', words: ['道具', '物品'] },
  { kind: 'block', words: ['方块'] },
  { kind: 'effect', words: ['特效'] },
  { kind: 'sound', words: ['音效', '声音'] },
  { kind: 'creature', words: ['生物', '怪物'] },
  { kind: 'particle', words: ['粒子特效', '粒子'] },
  { kind: 'buff', words: ['buff', 'Buff', 'BUFF'] },
  { kind: 'ui', words: ['界面', 'UI'] },
  { kind: 'var', words: ['变量'] },
  { kind: 'comp', words: ['元件'] },
];

/* '方块ID为1', '道具ID: 12', '方块 ID = 376' */
const VALUE_RE = (words) =>
  new RegExp('(?:' + words.join('|') + ')\\s*(?:ID|Id|id)?\\s*(?:为|是|=|:|：)\\s*(\\d{1,7})', 'g');
/* mentions with or without a number, for the statistics line */
const MENTION_RE = (words) => new RegExp('(?:' + words.join('|') + ')\\s*(?:ID|Id|id)', 'g');

function sentenceAround(text, index, length) {
  let start = 0;
  for (let i = index - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === '。' || ch === '；' || ch === '\n' || ch === ';') { start = i + 1; break; }
  }
  let end = text.length;
  for (let i = index + length; i < text.length; i++) {
    const ch = text[i];
    if (ch === '。' || ch === '；' || ch === '\n' || ch === ';') { end = i; break; }
  }
  return text.slice(start, end).trim().replace(/\s+/g, ' ').slice(0, 40);
}

function sentencesOf(value, out) {
  if (typeof value === 'string') {
    if (value.length >= 4) out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) sentencesOf(item, out);
    return;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key === 'id' || key === 'page') continue;
      sentencesOf(value[key], out);
    }
  }
}

export function collectText(index) {
  const out = [];
  for (const api of index.apis || []) {
    out.push(api.name, api.sig, api.note, api.example, api.desc);
    sentencesOf(api.params, out);
    sentencesOf(api.returns, out);
  }
  for (const event of index.events || []) {
    out.push(event.name, event.desc);
    sentencesOf(event.params, out);
  }
  for (const doc of index.docs || []) {
    out.push(doc.title);
    sentencesOf(doc.sections, out);
  }
  return out.filter((text) => typeof text === 'string' && text.length > 0);
}

/** Returns { ids, mentions, scanned }. ids are {kind,name,value,note}. */
export function harvest(index) {
  const texts = collectText(index);
  const ids = [];
  const seen = new Set();
  const mentions = {};
  for (const entry of KIND_WORDS) mentions[entry.kind] = 0;

  for (const text of texts) {
    for (const entry of KIND_WORDS) {
      const mentionRe = MENTION_RE(entry.words);
      let mm;
      while ((mm = mentionRe.exec(text))) mentions[entry.kind]++;

      const valueRe = VALUE_RE(entry.words);
      let m;
      while ((m = valueRe.exec(text))) {
        const value = m[1];
        let name = sentenceAround(text, m.index, m[0].length) || entry.kind + 'ID';
        if (/^--|\blocal\b|function\s|\breturn\b/.test(name)) name = entry.kind + 'ID（wiki 示例）';
        if (name.length < 3) name = entry.kind + 'ID';
        const key = entry.kind + '|' + name.toLowerCase() + '|' + value;
        if (seen.has(key)) continue;
        seen.add(key);
        ids.push({ kind: entry.kind, name: name, value: value, note: '由 wiki 正文/示例中提取' });
      }
    }
  }
  return { ids: ids, mentions: mentions, scanned: texts.length };
}