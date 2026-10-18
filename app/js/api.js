// Talking to the Apps Script web API.
// Requests are POSTs with a text/plain JSON body, which avoids a CORS preflight
// (Apps Script can't answer one). The household key goes in the body, never the URL.

export class ApiError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

/** Network trouble (offline, timeout, DNS): worth retrying later. */
export class NetworkError extends Error {
  constructor(message) {
    super(message || 'Network unavailable');
    this.code = 'offline';
  }
}

const TIMEOUT_MS = 30000;

/**
 * Returns call(action, body, member) -> data.
 * `transport` can be swapped for the demo server; the real one uses fetch.
 */
export function createApi(opts) {
  if (opts.demo) return opts.demo.call.bind(opts.demo);
  const url = opts.url;
  const key = opts.key;
  return async function call(action, body, member) {
    const payload = Object.assign({}, body || {}, { key: key, action: action, member: member || 'system' });
    let res;
    try {
      res = await fetchWithTimeout(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        redirect: 'follow',
        credentials: 'omit',
        cache: 'no-store'
      });
    } catch (e) {
      throw new NetworkError(e && e.message);
    }
    if (!res.ok) throw new NetworkError('HTTP ' + res.status);
    let json;
    try {
      json = await res.json();
    } catch (e) {
      // Apps Script answers with an HTML page when the deployment isn't public.
      throw new ApiError('not_json', 'The hub address answered with a web page, not data. Check the deployment is set to "Anyone".');
    }
    if (!json.ok) throw new ApiError(json.error && json.error.code, json.error && json.error.message);
    return json.data;
  };
}

function fetchWithTimeout(url, init) {
  if (typeof AbortController === 'undefined') {
    return Promise.race([
      fetch(url, init),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS))
    ]);
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(url, Object.assign({}, init, { signal: ctrl.signal })).then(
    (r) => { clearTimeout(timer); return r; },
    (e) => { clearTimeout(timer); throw e; }
  );
}
