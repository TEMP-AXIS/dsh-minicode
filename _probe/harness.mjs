import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../client.js', import.meta.url), 'utf8');

/** Minimal hook runtime: enough to render the settings page outside a browser. */
export function createHarness(fetchImpl) {
  let frames = new Map();
  let cursor = 0;
  let owner = 'root';
  let ownerCount = {};
  let pendingEffects = [];
  let dirty = false;
  const text = [];
  const nodes = [];

  let seen = new Set();
  const frameFor = (slot) => {
    const key = owner + ':' + cursor + ':' + slot;
    cursor += 1;
    seen.add(key);
    if (!frames.has(key)) frames.set(key, {});
    return frames.get(key);
  };

  const React = {
    createElement: (type, props, ...kids) => ({ type, props: props || {}, kids: kids.flat(9) }),
    useState(initial) {
      const frame = frameFor('s');
      if (!('state' in frame)) frame.state = typeof initial === 'function' ? initial() : initial;
      const set = (next) => {
        const value = typeof next === 'function' ? next(frame.state) : next;
        if (value !== frame.state) { frame.state = value; dirty = true; }
      };
      return [frame.state, set];
    },
    useEffect(fn, deps) {
      const frame = frameFor('e');
      const prev = frame.deps;
      const changed = prev === undefined || !deps || deps.length !== prev.length || deps.some((d, i) => d !== prev[i]);
      frame.deps = deps;
      if (changed) pendingEffects.push(fn);
    },
    useMemo(fn) { return fn(); },
    useCallback(fn) { const f = frameFor('c'); if (!f.fn) f.fn = fn; return f.fn; },
    useRef(value) { const f = frameFor('r'); if (!('cur' in f)) f.cur = { current: value }; return f.cur; },
  };

  function walk(node) {
    if (node === null || node === undefined || node === false || node === true) return;
    if (Array.isArray(node)) { for (const child of node) walk(child); return; }
    if (typeof node === 'string' || typeof node === 'number') { text.push(String(node)); return; }
    if (typeof node.type === 'function') {
      const name = node.type.name || 'anon';
      owner = name + (ownerCount[name] = (ownerCount[name] || 0) + 1);
      cursor = 0;
      let out;
      try { out = node.type(Object.assign({}, node.props, { children: node.kids })); }
      catch (err) { throw new Error('render failed in ' + name + ': ' + err.message); }
      walk(out);
      return;
    }
    if (typeof node.type === 'string') {
      nodes.push(node);
      walk(node.kids);
    }
  }

  let root = null;
  const api = {
    React,
    async mount(component, props) {
      root = { type: component, props: props || {}, kids: [] };
      return api.render();
    },
    async render() {
      for (let pass = 0; pass < 40; pass++) {
        text.length = 0;
        nodes.length = 0;
        cursor = 0;
        owner = 'root';
        ownerCount = {};
        pendingEffects = [];
        dirty = false;
        seen = new Set();
        walk(root);
        // unmount components that are no longer in the tree, like React does
        for (const key of [...frames.keys()]) if (!seen.has(key)) frames.delete(key);
        if (!pendingEffects.length && !dirty) return pass;
        for (const effect of pendingEffects) {
          try { effect(); } catch (err) { throw new Error('effect failed: ' + err.message); }
        }
        await new Promise((r) => setTimeout(r, 20));
      }
      return 24;
    },
    button(label) {
      const hit = nodes.filter((node) => node.type === 'button' && (node.kids || []).flat(9).join('') === label)[0];
      return hit || null;
    },
    buttons() {
      return nodes.filter((node) => node.type === 'button').map((node) => (node.kids || []).flat(9).join(''));
    },
    inputs() {
      return nodes.filter((node) => node.type === 'input' || node.type === 'textarea');
    },
    /** Type into the i-th input, fire its onChange and re-render like React would. */
    async type(index, value) {
      const field = api.inputs()[index];
      if (!field) throw new Error('no input at ' + index + '; have ' + api.inputs().length);
      field.props.onChange({ target: { value } });
      return api.render();
    },
    async click(label) {
      const hit = api.button(label);
      if (!hit) throw new Error('no button "' + label + '"; have: ' + api.buttons().join(', '));
      hit.props.onClick();
      return api.render();
    },
    dump() { return text.join(' | '); },
  };

  let captured = null;
  const sandbox = {
    window: { __ModuleLoader__: { load: (m) => { captured = m; } } },
    fetch: fetchImpl,
    setInterval: () => 0,
    clearInterval: () => {},
    setTimeout: (fn) => 0,
    clearTimeout: () => {},
    console,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: 'client.js' });
  api.module = captured.factory((name) => { if (name === 'react') return React; throw new Error('unknown require ' + name); });
  api.id = captured.id;
  return api;
}