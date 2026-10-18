// The app's data, in memory, backed by IndexedDB.
//
// What the screens see = the last copy confirmed by the Sheet ("snapshot")
// with this device's not-yet-synced changes ("outbox") laid on top.
// So a tap shows up instantly, works offline, and survives a reload;
// the sync engine later sends the outbox and swaps in the Sheet's answer.

import { openDb, deleteDb } from './db.js';
import { TABLE_NAMES, PREFIX, newId } from './schema.js';

const snapshot = {};      // table -> Map(id -> row)
const settings = new Map(); // key -> { key, value, updated_at }
let outbox = [];          // [{ seq, kind: 'change'|'call', member, ... }]
const meta = new Map();   // k -> v
let db = null;
let persistent = true;
let dbName = '';

let version = 0;
const viewCache = {};
const listeners = new Set();
let notifyQueued = false;
let onLocalChange = () => {};

export async function initStore(name) {
  dbName = name;
  const opened = await openDb(name);
  db = opened.store;
  persistent = opened.persistent;
  TABLE_NAMES.forEach((t) => { snapshot[t] = new Map(); });
  const loads = TABLE_NAMES.map((t) => db.getAll(t).then((rows) => rows.forEach((r) => snapshot[t].set(r.id, r))));
  loads.push(db.getAll('settings').then((rows) => rows.forEach((r) => settings.set(r.key, r))));
  loads.push(db.getAll('outbox').then((rows) => { outbox = rows.sort((a, b) => a.seq - b.seq); }));
  loads.push(db.getAll('meta').then((rows) => rows.forEach((r) => meta.set(r.k, r.v))));
  await Promise.all(loads);
  bump();
}

export function isPersistent() { return persistent; }

/** Called whenever this device changes something (the sync engine hooks in here). */
export function setLocalChangeHandler(fn) { onLocalChange = fn; }

/* ---------- Reading ---------- */

/** All rows of a table, with local changes applied. Deleted rows are left out unless asked. */
export function rows(table, opts) {
  const includeDeleted = !!(opts && opts.includeDeleted);
  let cached = viewCache[table];
  if (!cached || cached.version !== version) {
    const merged = new Map(snapshot[table]);
    outbox.forEach((e) => {
      if (e.kind !== 'change' || e.change.table !== table) return;
      const id = e.change.deleted ? e.change.id : e.change.row.id;
      const base = merged.get(id) || { id: id, created_at: e.at, deleted: false };
      const patch = e.change.deleted ? { deleted: true } : e.change.row;
      merged.set(id, Object.assign({}, base, patch, { updated_at: e.at, _pending: true }));
    });
    const all = Array.from(merged.values());
    cached = viewCache[table] = { version: version, all: all, live: all.filter((r) => !r.deleted) };
  }
  return includeDeleted ? cached.all : cached.live;
}

export function row(table, id) {
  return rows(table, { includeDeleted: true }).find((r) => r.id === id) || null;
}

export function setting(key, fallback) {
  for (let i = outbox.length - 1; i >= 0; i--) {
    const e = outbox[i];
    if (e.kind === 'change' && e.change.table === 'Settings' && e.change.key === key) return e.change.value;
  }
  const s = settings.get(key);
  return s && s.value !== '' ? s.value : (fallback === undefined ? '' : fallback);
}

export function hasData() {
  return meta.has('cursor');
}

export function getMeta(k) { return meta.get(k); }

export async function setMeta(k, v) {
  meta.set(k, v);
  await db.putMany('meta', [{ k: k, v: v }]);
}

/* ---------- Subscribing ---------- */

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function bump() {
  version += 1;
  if (notifyQueued) return;
  notifyQueued = true;
  Promise.resolve().then(() => {
    notifyQueued = false;
    listeners.forEach((fn) => { try { fn(version); } catch (e) { console.error(e); } });
  });
}

/* ---------- Writing (this device) ---------- */

let lastSeq = 0;
function nextSeq() {
  lastSeq = Math.max(Date.now() * 1000, lastSeq + 1, outbox.length ? outbox[outbox.length - 1].seq + 1 : 0);
  return lastSeq;
}

/** Shows the change on screen first, then saves it, so a tap never waits on storage. */
async function enqueue(entry) {
  entry.at = new Date().toISOString();
  entry.seq = nextSeq();
  outbox.push(entry);
  bump();
  await db.putMany('outbox', [entry]);
  onLocalChange();
}

/** Create or change a row. Pass only the fields that changed. Returns the row's id. */
export async function save(table, fields, member) {
  if (!PREFIX[table]) throw new Error('Unknown table ' + table);
  const rowData = Object.assign({}, fields);
  if (!rowData.id) rowData.id = newId(table);
  delete rowData.created_at; delete rowData.updated_at; delete rowData.updated_by; delete rowData._pending;
  await enqueue({ kind: 'change', member: member, change: { table: table, row: rowData } });
  return rowData.id;
}

export async function remove(table, id, member) {
  await enqueue({ kind: 'change', member: member, change: { table: table, id: id, deleted: true } });
}

export async function saveSetting(key, value, member) {
  await enqueue({ kind: 'change', member: member, change: { table: 'Settings', key: key, value: String(value) } });
}

/** Queue a server action that isn't a plain row change (e.g. completeChore). */
export async function queueCall(action, payload, member) {
  await enqueue({ kind: 'call', member: member, action: action, payload: payload });
}

/* ---------- Used by the sync engine ---------- */

export function pendingOutbox() { return outbox.slice(); }

export async function ackOutbox(seqs) {
  const done = new Set(seqs);
  outbox = outbox.filter((e) => !done.has(e.seq));
  await db.deleteMany('outbox', seqs);
  bump();
}

/**
 * Stores what the Sheet sent back.
 *   result: { cursor?, tables: { Name: [rows] }, settings: [{ key, value, updated_at }] }
 *   replace: true for a full bootstrap (drops everything held before)
 */
export async function applyServer(result, replace) {
  const tables = result.tables || {};
  if (replace) {
    await db.clear(TABLE_NAMES.concat(['settings']));
    TABLE_NAMES.forEach((t) => snapshot[t].clear());
    settings.clear();
  }
  const writes = [];
  Object.keys(tables).forEach((t) => {
    if (!snapshot[t]) return;
    const list = tables[t] || [];
    list.forEach((r) => snapshot[t].set(r.id, r));
    writes.push(db.putMany(t, list));
  });
  const s = result.settings || [];
  s.forEach((r) => settings.set(r.key, r));
  writes.push(db.putMany('settings', s));
  await Promise.all(writes);
  if (result.cursor) await setMeta('cursor', result.cursor);
  await setMeta('lastSync', new Date().toISOString());
  bump();
}

/** Forget everything on this device (used by "Remove this device"). */
export async function wipe() {
  await deleteDb(dbName);
}
