// IndexedDB, wrapped in promises. One object store per Sheet tab, plus:
//   settings  (key -> { key, value, updated_at })
//   outbox    (changes made on this device that the Sheet hasn't confirmed yet)
//   meta      (sync cursor and other bookkeeping)
// If IndexedDB isn't available (some private windows), a memory-only store keeps the
// app working; it just forgets everything on reload.

import { TABLE_NAMES } from './schema.js';

const VERSION = 1;

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

class IdbStore {
  constructor(db) { this.db = db; }

  async getAll(store) {
    return req(this.db.transaction(store, 'readonly').objectStore(store).getAll());
  }

  async putMany(store, rows) {
    if (!rows.length) return;
    const tx = this.db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    rows.forEach((r) => os.put(r));
    return txDone(tx);
  }

  async add(store, row) {
    const tx = this.db.transaction(store, 'readwrite');
    const key = await req(tx.objectStore(store).add(row));
    await txDone(tx);
    return key;
  }

  async deleteMany(store, keys) {
    if (!keys.length) return;
    const tx = this.db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    keys.forEach((k) => os.delete(k));
    return txDone(tx);
  }

  async clear(stores) {
    const tx = this.db.transaction(stores, 'readwrite');
    stores.forEach((s) => tx.objectStore(s).clear());
    return txDone(tx);
  }
}

class MemoryStore {
  constructor() { this.data = {}; this.seq = 0; }
  bucket(s) { return this.data[s] || (this.data[s] = new Map()); }
  async getAll(store) { return Array.from(this.bucket(store).values()); }
  async putMany(store, rows) {
    const keyOf = keyPathOf(store);
    rows.forEach((r) => this.bucket(store).set(r[keyOf], r));
  }
  async add(store, row) {
    this.seq += 1;
    const copy = Object.assign({}, row, { seq: this.seq });
    this.bucket(store).set(this.seq, copy);
    return this.seq;
  }
  async deleteMany(store, keys) { keys.forEach((k) => this.bucket(store).delete(k)); }
  async clear(stores) { stores.forEach((s) => this.bucket(s).clear()); }
}

function keyPathOf(store) {
  if (store === 'settings') return 'key';
  if (store === 'outbox') return 'seq';
  if (store === 'meta') return 'k';
  return 'id';
}

export async function openDb(name) {
  if (!('indexedDB' in window)) return { store: new MemoryStore(), persistent: false };
  try {
    const open = indexedDB.open(name, VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      TABLE_NAMES.forEach((t) => { if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: 'id' }); });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
    };
    const db = await req(open);
    return { store: new IdbStore(db), persistent: true };
  } catch (e) {
    console.warn('IndexedDB unavailable, using memory only', e);
    return { store: new MemoryStore(), persistent: false };
  }
}

export async function deleteDb(name) {
  if (!('indexedDB' in window)) return;
  await req(indexedDB.deleteDatabase(name)).catch(() => {});
}
