// Minimal, dependency-free HTML tree builder for server-rendered VitePress pages.
const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const RAW = new Set(['script','style','textarea','title']);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ', '#39': "'" };

export function decodeEntities(s) {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code)) return m;
      try { return String.fromCodePoint(code); } catch { return m; }
    }
    const v = ENTITIES[body];
    return v === undefined ? m : v;
  });
}

function parseAttrs(src) {
  const attrs = {};
  const re = /([^\s"'>/=]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1].toLowerCase();
    const value = m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[5] !== undefined ? m[5] : '';
    attrs[name] = decodeEntities(value);
  }
  return attrs;
}

/**
 * Parse an HTML string into a tree of { tag, attrs, children } elements and
 * { text } text nodes. Tolerant: unmatched end tags are ignored, unclosed
 * elements are closed at end of input.
 */
export function parseHtml(src) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  let i = 0;
  const top = () => stack[stack.length - 1];
  const pushText = (raw) => {
    if (!raw) return;
    const text = decodeEntities(raw);
    if (text) top().children.push({ text });
  };
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt < 0) { pushText(src.slice(i)); break; }
    if (lt > i) pushText(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4);
      i = end < 0 ? src.length : end + 3;
      continue;
    }
    if (src.startsWith('<!', lt) || src.startsWith('<?', lt)) {
      const end = src.indexOf('>', lt);
      i = end < 0 ? src.length : end + 1;
      continue;
    }
    const gt = src.indexOf('>', lt);
    if (gt < 0) { pushText(src.slice(lt)); break; }
    const inner = src.slice(lt + 1, gt);
    if (inner.startsWith('/')) {
      const name = inner.slice(1).trim().toLowerCase();
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].tag === name) { stack.length = k; break; }
      }
      i = gt + 1;
      continue;
    }
    const selfClose = inner.endsWith('/');
    const body = selfClose ? inner.slice(0, -1) : inner;
    const sp = body.search(/[\s\/]/);
    const name = (sp < 0 ? body : body.slice(0, sp)).toLowerCase();
    if (!name) { pushText(src.slice(lt, gt + 1)); i = gt + 1; continue; }
    const attrs = sp < 0 ? {} : parseAttrs(body.slice(sp));
    const el = { tag: name, attrs, children: [] };
    top().children.push(el);
    i = gt + 1;
    if (selfClose || VOID.has(name)) continue;
    if (RAW.has(name)) {
      const close = src.toLowerCase().indexOf('</' + name, i);
      const end = close < 0 ? src.length : close;
      if (end > i) el.children.push({ text: src.slice(i, end) });
      i = close < 0 ? src.length : src.indexOf('>', close) + 1 || src.length;
      continue;
    }
    stack.push(el);
  }
  return root;
}

export function classes(el) {
  const c = el && el.attrs && el.attrs.class;
  return c ? c.split(/\s+/).filter(Boolean) : [];
}

export function hasClass(el, name) {
  return classes(el).includes(name);
}

/** Depth-first search; returns the first element matching pred. */
export function findEl(node, pred) {
  const kids = node.children || [];
  for (const kid of kids) {
    if (kid.tag && pred(kid)) return kid;
  }
  for (const kid of kids) {
    if (!kid.tag) continue;
    const hit = findEl(kid, pred);
    if (hit) return hit;
  }
  return null;
}

export function findAllEl(node, pred, out = []) {
  for (const kid of node.children || []) {
    if (!kid.tag) continue;
    if (pred(kid)) out.push(kid);
    findAllEl(kid, pred, out);
  }
  return out;
}

/** Direct children that are elements. */
export function childEls(node) {
  return (node.children || []).filter((k) => k.tag);
}

export function childByTag(node, tag) {
  return (node.children || []).find((k) => k.tag === tag) || null;
}

/** Flattened text content with normalized whitespace. */
export function textOf(node) {
  if (!node) return '';
  if (node.text !== undefined) return node.text;
  let out = '';
  for (const kid of node.children || []) out += textOf(kid);
  return out;
}

export function clean(s) {
  return String(s || '')
    .replace(/\u200b/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** Text content with block-level separators so paragraphs stay readable. */
const BLOCK = new Set(['p','div','li','ul','ol','h1','h2','h3','h4','h5','h6','tr','table','pre','blockquote','section','br','dt','dd']);

export function blockText(node) {
  const parts = [];
  const walk = (n) => {
    if (n.text !== undefined) { parts.push(n.text); return; }
    const isBlock = n.tag && BLOCK.has(n.tag);
    if (isBlock) parts.push('\n');
    for (const kid of n.children || []) walk(kid);
    if (isBlock) parts.push('\n');
  };
  walk(node);
  return clean(parts.join('')
    .replace(/\n{2,}/g, '\n')
    .replace(/ ?\n ?/g, '\n'));
}
