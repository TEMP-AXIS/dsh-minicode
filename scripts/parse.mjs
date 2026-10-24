// Page-shape parsing for the MiniWorld UGC wiki (VitePress, server-rendered HTML).
import { parseHtml, findEl, findAllEl, textOf, clean, hasClass, childEls } from '../lib/html.mjs';

const LABEL_PARAMS = /^参数及类型/;
const LABEL_RETURNS = /^返回值及类型/;
const LABEL_NOTE = /^(该方法的其他说明|该方法的主要作用|方法说明|其他说明|说明|注意)/;

function vpDoc(root) {
  return findEl(root, (el) => hasClass(el, 'vp-doc'));
}

/** VitePress wraps the markdown body in single-child divs; descend to the block level. */
function contentRoot(doc) {
  let node = doc;
  for (let depth = 0; depth < 12; depth++) {
    const kids = node.children.filter((k) => k.tag);
    if (kids.some((k) => k.tag === 'h1' || k.tag === 'h2' || k.tag === 'h3' || k.tag === 'table' || k.tag === 'ul')) return node;
    if (kids.length === 1) { node = kids[0]; continue; }
    return node;
  }
  return node;
}

function headingText(el) {
  const clone = { children: (el.children || []).filter((k) => !(k.tag === 'a' && hasClass(k, 'header-anchor'))) };
  return clean(textOf(clone));
}

function codeText(el) {
  const pre = el.tag === 'pre' ? el : findEl(el, (e) => e.tag === 'pre');
  if (!pre) return '';
  const lines = findAllEl(pre, (e) => e.tag === 'span' && hasClass(e, 'line'));
  const raw = lines.length ? lines.map((l) => textOf(l)).join('\n') : textOf(pre);
  return raw.replace(/\u00a0/g, ' ').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').trim();
}

function tableRows(table) {
  const tbody = findEl(table, (e) => e.tag === 'tbody') || table;
  return findAllEl(tbody, (e) => e.tag === 'tr').map((tr) => childEls(tr).map((td) => clean(textOf(td))));
}

function tableHeader(table) {
  const thead = findEl(table, (e) => e.tag === 'thead');
  const tr = thead ? findEl(thead, (e) => e.tag === 'tr') : null;
  return tr ? childEls(tr).map((th) => clean(textOf(th))) : [];
}

function headersIn(doc) {
  return findAllEl(doc, (e) => e.tag === 'table').map((t) => tableHeader(t));
}

function hasTableWith(doc, needle) {
  return headersIn(doc).some((h) => h.some((c) => c.includes(needle)));
}

/**
 * One "name:type desc" entry such as
 * <li>objid:<a href="./global.html#lua_type"><strong><code>number</code></strong></a> 掉落物对象ID</li>
 * The type comes from <code> when present, otherwise from the <strong>/<a> text.
 */
const TYPE_TOKEN = /^[a-zA-Z][A-Za-z0-9_.|]{0,24}$/;

/** "name:type", "name:type desc", "name:type:desc" written as plain text. */
function parseTextItem(li) {
  const full = clean(textOf(li));
  const m = /^([^:：]*)[:：]\s*(.*)$/.exec(full);
  let name = m ? clean(m[1]) : '';
  let rest = m ? clean(m[2]) : full;
  let type = '';
  if (TYPE_TOKEN.test(rest)) { type = rest; rest = ''; }
  else {
    const spaced = /^([a-zA-Z][A-Za-z0-9_.|]{0,24})[\s:：]+(.*)$/.exec(rest);
    if (spaced && (TYPE_TOKEN.test(spaced[1]) || /^[a-z]/.test(spaced[1]))) { type = spaced[1]; rest = spaced[2]; }
    else {
      const glued = splitGluedType(rest);
      if (glued) { type = glued.type; rest = glued.desc; }
    }
  }
  if (!m) name = '';
  return { name: name, type: type, desc: clean(rest) };
}

function parseTypedItem(li) {
  if (!(li.children || []).some((k) => k.tag)) return parseTextItem(li);
  const kids = li.children || [];
  let name = '';
  let type = '';
  let sawTypeEl = false;
  const parts = [];
  for (const kid of kids) {
    if (kid.text !== undefined) {
      if (!sawTypeEl && !parts.length) {
        const m = /^([^:：]*)[:：]?\s*/.exec(kid.text);
        name += m ? m[1] : '';
        const rest = kid.text.slice(m ? m[0].length : 0);
        if (rest) parts.push(rest);
      } else parts.push(kid.text);
      continue;
    }
    if (!sawTypeEl) {
      const code = findEl(kid, (e) => e.tag === 'code') || (kid.tag === 'code' ? kid : null);
      const strong = findEl(kid, (e) => e.tag === 'strong') || (kid.tag === 'strong' ? kid : null);
      const t = clean(textOf(code || strong || kid));
      if (t) { type = t; sawTypeEl = true; continue; }
      parts.push(textOf(kid));
      continue;
    }
    const t = clean(textOf(kid));
    if (!t) continue;
    const joined = parts.join('');
    if (t === type || joined.includes(t)) continue;
    parts.push(t);
  }
  let desc = clean(parts.join(''));
  if (type) desc = clean(desc.split('(' + type + ')').join(''));
  else {
    // Plain-text forms: "value:any具体值" and "color:number:颜色值".
    const colon = /^([a-zA-Z][A-Za-z0-9_.]{1,20})[:：]\s*(?=[^:：])/.exec(desc);
    if (colon) { type = colon[1]; desc = clean(desc.slice(colon[0].length)); }
    else {
      const glued = splitGluedType(desc);
      if (glued) { type = glued.type; desc = glued.desc; }
    }
  }
  return { name: clean(name).replace(/[:：]$/, ''), type: type, desc: desc };
}

/** Remove a leading list label ("事件描述： ", "该方法的其他说明： ") from body text. */
function stripLabel(text, pattern) {
  return clean(String(text || '').replace(pattern, ''));
}

const NOTE_PREFIX = /^(该方法的其他说明|该方法的主要作用|方法说明|其他说明|说明|注意)[:：]?\s*/;
const EVENT_DESC_PREFIX = /^事件描述[:：]?\s*/;
const EVENT_NAME_PREFIX = /^事件名[:：]?\s*/;

/** Glued plain-text types ("value:any具体值") have no <code> wrapper. */
function splitGluedType(body) {
  const m = /^([a-z][a-z0-9_]{0,15})(?=[\u4e00-\u9fff])/.exec(body);
  if (!m) return null;
  const known = ['any', 'number', 'string', 'boolean', 'bool', 'table', 'function', 'nil', 'userdata', 'integer', 'int', 'float', 'double', 'long', 'object', 'void', 'json', 'vec3'];
  if (!known.includes(m[1])) return null;
  return { type: m[1], desc: clean(body.slice(m[1].length)) };
}

function usefulParam(p) {
  if (p.name || p.type) return true;
  return !!p.desc && p.desc !== '无' && p.desc !== '无参数';
}

function ulItems(ul) {
  return childEls(ul).filter((li) => li.tag === 'li');
}

function labelItems(ul) {
  return ulItems(ul).map((li) => {
    const first = (li.children || [])[0];
    return { label: clean(first && first.text !== undefined ? first.text : ''), li: li };
  });
}

function nestedUl(li) {
  return findEl(li, (e) => e.tag === 'ul');
}

/** Split block children on a heading tag, yielding [heading, block] pairs. */
function sectionsByHeading(kids, tag) {
  const out = [];
  let i = 0;
  while (i < kids.length) {
    const head = kids[i];
    if (head.tag !== tag) { i++; continue; }
    const block = [];
    let j = i + 1;
    while (j < kids.length && kids[j].tag !== tag) { block.push(kids[j]); j++; }
    out.push({ head: head, block: block });
    i = j;
  }
  return out;
}

function parseApiSection(head, block, ctx) {
  const anchor = head.attrs.id || '';
  const name = headingText(head);
  const rec = {
    kind: 'api',
    id: (ctx.module + ':' + (anchor || name)).toLowerCase(),
    module: ctx.module,
    moduleCn: ctx.moduleCn,
    receiver: ctx.receiver,
    name: name,
    anchor: anchor,
    page: ctx.page,
    desc: ctx.desc || '',
    sig: '',
    params: [],
    returns: [],
    note: '',
    example: '',
  };
  for (const el of block) {
    if (el.tag === 'ul' && !rec.params.length && !rec.returns.length && !rec.note) {
      for (const entry of labelItems(el)) {
        const label = entry.label;
        const li = entry.li;
        if (LABEL_PARAMS.test(label)) {
          const inner = nestedUl(li);
          if (inner) rec.params = ulItems(inner).map(parseTypedItem).filter(usefulParam);
          else {
            const rest = stripLabel(clean(textOf(li)), /^参数及类型[:：]?\s*/);
            if (rest) rec.params = [parseTextItem({ children: [{ text: rest }] })].filter((p) => p.name || p.type || p.desc);
          }
        } else if (LABEL_RETURNS.test(label)) {
          const inner = nestedUl(li);
          if (inner) rec.returns = ulItems(inner).map(parseTypedItem).filter((p) => p.name || p.type || p.desc);
          else {
            const rest = stripLabel(clean(textOf(li)), /^返回值及类型[:：]?\s*/);
            if (rest) rec.returns = [parseTextItem({ children: [{ text: rest }] })].filter((p) => p.name || p.type || p.desc);
          }
        } else if (LABEL_NOTE.test(label)) {
          const inner = nestedUl(li);
          rec.note = stripLabel(clean(textOf(inner || li)), NOTE_PREFIX);
        }
      }
      continue;
    }
    if (!rec.example && hasClass(el, 'language-lua')) rec.example = codeText(el);
  }
  const args = rec.params.map((p) => p.name).filter(Boolean);
  rec.sig = (ctx.receiver ? ctx.receiver + ':' : '') + name + '(' + args.join(', ') + ')';
  return rec;
}

function collectApis(kids, doc, info, pagePath) {
  const fnTable = findAllEl(doc, (e) => e.tag === 'table').find((t) => {
    const h = tableHeader(t);
    return h.some((c) => c.includes('序号')) && h.some((c) => c.includes('函数名'));
  });
  const descMap = new Map();
  if (fnTable) {
    for (const row of tableRows(fnTable)) {
      const nameCell = (row[1] || '').replace(/\(\.\.\.\)$/, '').trim();
      if (nameCell) descMap.set(nameCell.toLowerCase(), row[2] || '');
    }
  }
  return sectionsByHeading(kids, 'h2')
    .map((pair) => {
      const name = headingText(pair.head);
      if (!name) return null;
      return parseApiSection(pair.head, pair.block, { ...info, page: pagePath, desc: descMap.get(clean(name).toLowerCase()) || '' });
    })
    .filter((r) => r && r.name);
}

function parseEventSection(head, block, ctx) {
  const anchor = head.attrs.id || '';
  const rec = { kind: 'event', module: ctx.module, name: '', anchor: anchor, page: ctx.page, desc: '', params: [] };
  for (const el of block) {
    if (el.tag !== 'ul') continue;
    for (const entry of labelItems(el)) {
      const label = entry.label;
      const li = entry.li;
      if (/^事件描述/.test(label)) {
        rec.desc = stripLabel(clean(textOf(li)), EVENT_DESC_PREFIX);
      } else if (/^事件名/.test(label)) {
        const strong = findEl(li, (e) => e.tag === 'strong');
        rec.name = strong ? clean(textOf(strong)) : stripLabel(clean(textOf(li)), EVENT_NAME_PREFIX);
      } else if (/^事件传参/.test(label)) {
        const table = findEl(li, (e) => e.tag === 'table');
        if (table) {
          rec.params = tableRows(table).map((cells) => ({ name: clean(cells[0] || ''), type: '', desc: clean(cells[1] || '') }));
        }
      }
    }
  }
  if (!rec.name) rec.name = headingText(head);
  const short = rec.name.replace(/^[^.]*\./, '').toLowerCase();
  rec.id = ctx.module + ':' + (short || anchor);
  return rec;
}

function collectEvents(kids, info, pagePath) {
  return sectionsByHeading(kids, 'h3')
    .map((pair) => parseEventSection(pair.head, pair.block, { ...info, page: pagePath }))
    .filter((r) => r.name);
}

function collectEnums(kids, pagePath) {
  const groups = [];
  let current = null;
  for (const el of kids) {
    if (el.tag === 'h2') {
      current = { kind: 'enum', name: headingText(el), anchor: el.attrs.id || '', page: pagePath, values: [] };
      groups.push(current);
      continue;
    }
    if (el.tag === 'table' && current) {
      const header = tableHeader(el);
      if (!header.some((h) => h.includes('用法描述'))) continue;
      current.values = tableRows(el)
        .map((cells) => ({ name: clean(cells[0] || ''), desc: clean(cells[1] || '') }))
        .filter((v) => v.name);
    }
  }
  return groups.filter((g) => g.values.length);
}

function collectSections(kids, title, pagePath) {
  const sections = [];
  let current = { id: '', title: title || pagePath, level: 1, parts: [] };
  for (const el of kids) {
    if (el.tag === 'h1') continue;
    if (el.tag === 'h2' || el.tag === 'h3') {
      if (current.parts.length || !sections.length) sections.push(current);
      current = { id: el.attrs.id || '', title: headingText(el), level: el.tag === 'h2' ? 2 : 3, parts: [] };
      continue;
    }
    const t = el.tag === 'div' && hasClass(el, 'language-lua') ? codeText(el) : clean(textOf(el));
    if (t) current.parts.push(t);
  }
  if (current.parts.length || !sections.length) sections.push(current);
  return sections
    .map((s) => ({ id: s.id, title: s.title, level: s.level, text: clean(s.parts.join(' ')).slice(0, 8000) }))
    .filter((s) => s.text);
}

function pageKind(doc, pagePath) {
  const base = pagePath.replace(/^.*\//, '');
  if (base === 'triggerevent.html' || base === 'componentevent.html') return 'event';
  const hasFn = hasTableWith(doc, '序号') && hasTableWith(doc, '函数名');
  if (hasFn && pagePath.indexOf('/apis/') >= 0) return 'api';
  if (hasTableWith(doc, '用法描述') && base === 'global.html') return 'enum';
  return 'doc';
}

function moduleInfo(pagePath, title) {
  const base = pagePath.replace(/^.*\//, '').replace(/\.html$/, '');
  const m = /([A-Za-z][A-Za-z0-9_]*)\s*$/.exec(title || '');
  const receiver = m ? m[1] : '';
  const moduleCn = clean((title || '').replace(/[A-Za-z][A-Za-z0-9_]*\s*$/, '')) || base;
  return { base: base, module: base.toLowerCase(), receiver: receiver, moduleCn: moduleCn };
}

export function parsePage(input) {
  const pagePath = input.path;
  const root = parseHtml(input.html);
  const doc = vpDoc(root);
  if (!doc) return { path: pagePath, kind: 'empty' };
  const h1 = findEl(doc, (e) => e.tag === 'h1');
  const title = h1 ? headingText(h1) : '';
  const timeEl = findEl(root, (e) => e.tag === 'time' && !!(e.attrs && e.attrs.datetime));
  const kind = pageKind(doc, pagePath);
  const info = moduleInfo(pagePath, title);
  const kids = contentRoot(doc).children.filter((k) => k.tag);
  const out = { path: pagePath, kind: kind, title: title, updated: timeEl ? timeEl.attrs.datetime : '' };
  if (kind === 'api') {
    out.records = collectApis(kids, doc, info, pagePath);
  } else if (kind === 'event') {
    out.records = collectEvents(kids, info, pagePath);
  } else if (kind === 'enum') {
    out.records = collectEnums(kids, pagePath);
  } else {
    out.sections = collectSections(kids, title, pagePath);
    // Tutorial pages that embed a function table (组件函数, 全局函数, ...) also
    // carry real API documentation worth indexing.
    if (hasTableWith(doc, '序号') && hasTableWith(doc, '函数名')) {
      const extra = collectApis(kids, doc, info, pagePath);
      if (extra.length) out.extraApis = extra;
    }
  }
  return out;
}
