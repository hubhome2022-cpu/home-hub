// Background sync: sends this device's queued changes to the Sheet and pulls
// everyone else's. Screens never wait on it.
//
//   - first run: one 'bootstrap' downloads everything
//   - after that: 'sync' sends up to 500 queued changes and returns only rows changed
//     since the last cursor
//   - runs every 45 s, when the app comes back to the foreground or online,
//     and ~1.5 s after a local change
//   - offline or erroring: keeps the changes queued and retries with growing gaps

import * as store from './store.js';

const INTERVAL_MS = 45000;
const DEBOUNCE_MS = 1500;
const BACKOFF_MS = [5000, 15000, 30000, 60000, 120000];
const BATCH = 500;

let call = null;
let timer = null;
let running = null;
let again = false;
let failures = 0;
const listeners = new Set();

const status = {
  state: 'idle',      // idle | syncing | offline | error | needs_key
  pending: 0,
  lastSync: null,
  message: '',
  problems: []        // changes the Sheet refused: [{ when, code, message }]
};

export function getStatus() {
  status.pending = store.pendingOutbox().length;
  status.lastSync = store.getMeta('lastSync') || null;
  return status;
}

export function onStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(patch) {
  Object.assign(status, patch);
  getStatus();
  listeners.forEach((fn) => { try { fn(status); } catch (e) { console.error(e); } });
}

export function startSync(apiCall) {
  call = apiCall;
  store.setLocalChangeHandler(() => { emit({}); schedule(DEBOUNCE_MS); });
  window.addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
  syncNow();
}

function schedule(ms) {
  clearTimeout(timer);
  timer = setTimeout(syncNow, ms);
}

/** Starts a sync now (or right after the one in progress). Resolves when done. */
export function syncNow() {
  if (!call) return Promise.resolve();
  if (status.state === 'needs_key') return Promise.resolve();
  if (running) { again = true; return running; }
  clearTimeout(timer);
  running = run().then(() => {
    running = null;
    if (again) { again = false; return syncNow(); }
    return undefined;
  });
  return running;
}

async function run() {
  emit({ state: 'syncing', message: '' });
  try {
    if (!store.hasData()) {
      const data = await call('bootstrap', {});
      await store.applyServer(data, true);
    }
    let pulled = false;
    for (;;) {
      const queue = store.pendingOutbox();
      if (!queue.length) {
        if (!pulled) await pull([]);
        break;
      }
      const head = queue[0];
      if (head.kind === 'call') {
        await sendCall(head);
      } else {
        const batch = [];
        for (let i = 0; i < queue.length && batch.length < BATCH; i++) {
          if (queue[i].kind !== 'change' || queue[i].member !== head.member) break;
          batch.push(queue[i]);
        }
        await pull(batch);
        pulled = true;
      }
    }
    failures = 0;
    emit({ state: 'idle', message: '' });
    schedule(INTERVAL_MS);
  } catch (err) {
    handleError(err);
  }
}

async function pull(batch) {
  const res = await call('sync', {
    since: store.getMeta('cursor') || '',
    changes: batch.map((e) => e.change)
  }, batch.length ? batch[0].member : undefined);
  await store.applyServer(res, false);
  if (res.rejected && res.rejected.length) {
    res.rejected.forEach((r) => addProblem(r.code, r.message));
  }
  if (batch.length) await store.ackOutbox(batch.map((e) => e.seq));
}

async function sendCall(entry) {
  try {
    const res = await call(entry.action, entry.payload, entry.member);
    if (entry.action === 'completeChore' && res) {
      await store.applyServer({ tables: { Chores: [res.chore], ChoreLog: [res.log] } }, false);
    }
  } catch (err) {
    // A refusal (e.g. the chore was deleted) won't succeed on retry: drop it and say so.
    if (!err.code || err.code === 'offline' || err.code === 'busy' || err.code === 'bad_key' || err.code === 'not_json') throw err;
    addProblem(err.code, err.message);
  }
  await store.ackOutbox([entry.seq]);
}

function addProblem(code, message) {
  status.problems = [{ when: new Date().toISOString(), code: code, message: message }].concat(status.problems).slice(0, 20);
}

function handleError(err) {
  if (err.code === 'bad_key') {
    emit({ state: 'needs_key', message: 'This device needs the household key again.' });
    return;
  }
  failures += 1;
  const wait = BACKOFF_MS[Math.min(failures - 1, BACKOFF_MS.length - 1)];
  if (err.code === 'offline' || err.code === 'busy') {
    emit({ state: 'offline', message: navigator.onLine === false ? 'No internet connection' : 'Can\'t reach the hub right now' });
  } else {
    console.error(err);
    emit({ state: 'error', message: err.message || 'Sync failed' });
  }
  schedule(wait);
}
