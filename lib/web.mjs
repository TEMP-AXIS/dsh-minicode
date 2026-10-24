// Minimal HTTP plumbing for the Settings page endpoints: JSON in, JSON out,
// nothing buffered that a page cannot send.
export function sendJson(res, status, value) {
  let body = '';
  try {
    body = JSON.stringify(value);
  } catch (err) {
    body = JSON.stringify({ ok: false, error: 'unserialisable response: ' + String(err && err.message) });
  }
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-length', Buffer.byteLength(body));
  res.end(body);
}

export function ok(res, value) {
  sendJson(res, 200, Object.assign({ ok: true }, value || {}));
}

export function fail(res, status, message) {
  sendJson(res, status, { ok: false, error: String(message || 'error') });
}

/** Path below the registered prefix, with the query string removed. */
export function subPath(url, prefix) {
  const raw = String(url || '');
  const q = raw.indexOf('?');
  const pathname = q < 0 ? raw : raw.slice(0, q);
  if (prefix && pathname.startsWith(prefix)) {
    const rest = pathname.slice(prefix.length);
    return rest || '/';
  }
  return pathname;
}

export function queryOf(url) {
  const raw = String(url || '');
  const q = raw.indexOf('?');
  const out = {};
  if (q < 0) return out;
  for (const pair of raw.slice(q + 1).split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = eq < 0 ? pair : pair.slice(0, eq);
    const value = eq < 0 ? '' : pair.slice(eq + 1);
    try {
      out[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
    } catch {
      out[key] = value;
    }
  }
  return out;
}

export function readJsonBody(req, limit) {
  const cap = Number(limit) || 512 * 1024;
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > cap) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(new Error('invalid JSON body: ' + String(err && err.message)));
      }
    });
    req.on('error', reject);
  });
}