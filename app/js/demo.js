// Demo mode (open the app with ?demo): a pretend Sheet that lives in this browser,
// so the app can be tried and tested without the real household data or key.
// It follows the same rules as apps-script/Api.gs: server-stamped timestamps,
// partial updates, soft deletes and a sync cursor with a 10-second overlap.

import { ApiError, NetworkError } from './api.js';
import { TABLE_NAMES } from './schema.js';

const STORAGE_KEY = 'hh.demo.server';
const LATENCY_MS = 450;

function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function seed() {
  const now = new Date().toISOString();
  const today = ymd(new Date());
  const tomorrow = ymd(new Date(Date.now() + 864e5));
  const std = (id) => ({ id: id, created_at: now, updated_at: now, updated_by: 'system', deleted: false });
  const t = {};
  TABLE_NAMES.forEach((n) => { t[n] = {}; });
  const put = (table, fields) => { t[table][fields.id] = Object.assign(std(fields.id), fields); };

  put('Members', { id: 'mem_jeremy', name: 'Jeremy', initial: 'J', color: '#2B5C8A', chip_color: '#DCE7F3', sort_order: 1, active: true });
  put('Members', { id: 'mem_allison', name: 'Allison', initial: 'A', color: '#A64D72', chip_color: '#F5DFE8', sort_order: 2, active: true });
  [['Feed Scout breakfast', 'mem_allison'], ['Walk Scout', 'mem_jeremy'], ['Wipe kitchen counters', 'mem_allison'],
    ['Take out recycling', 'mem_jeremy'], ['Clean bathroom sinks', 'mem_allison']].forEach((c, i) => {
    put('Chores', { id: 'chr_demo' + i, title: c[0], room: i < 2 ? 'Scout' : 'Kitchen', rule: 'daily', rule_value: '',
      assign_mode: 'fixed', assignees: c[1], next_assignee: c[1], est_min: 10, next_due: i === 3 ? tomorrow : today, active: true });
  });
  put('Chores', { id: 'chr_demo9', title: 'Replace furnace filter', room: 'Utility', rule: 'every_n_days', rule_value: '90',
    assign_mode: 'fixed', assignees: 'mem_jeremy', next_assignee: 'mem_jeremy', est_min: 10,
    next_due: ymd(new Date(Date.now() - 2 * 864e5)), active: true });
  put('Recipes', { id: 'rcp_demo1', title: 'Lemon Chicken with Lemon Butter Sauce', tags: 'Chicken', servings: 4 });
  put('Recipes', { id: 'rcp_demo2', title: 'Spaghetti Aglio e Olio', tags: 'Pasta', servings: 4 });
  put('MealPlan', { id: 'mpl_demo1', date: today, meal: 'dinner', recipe_id: 'rcp_demo1' });
  put('MealPlan', { id: 'mpl_demo2', date: tomorrow, meal: 'dinner', recipe_id: 'rcp_demo2' });
  ['Lemons', 'Parsley', 'Romaine', 'Feta', "Scout's kibble"].forEach((g, i) => {
    put('Grocery', { id: 'grc_demo' + i, name: g, checked: i === 3 });
  });
  put('Notes', { id: 'nte_demo1', text: "Scout's new meds are on the top pantry shelf. One pill with dinner.", author: 'mem_allison',
    color: 'yellow', pinned: false, expires_at: new Date(Date.now() + 3 * 864e5).toISOString() });
  return {
    tables: t,
    settings: { timezone: 'America/Chicago', night_start: '21:00', night_end: '05:00', ambient_after_min: '5', nightly_reload: '03:00', units_distance: 'mi', week_starts_on: 'SUN' }
  };
}

export class DemoServer {
  constructor() {
    this.offline = false;
    try {
      this.data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (e) {
      this.data = null;
    }
    if (!this.data) this.data = seed();
    this.settingsStamp = this.data.settingsStamp || new Date(0).toISOString();
  }

  persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch (e) { /* full or blocked: demo only */ }
  }

  reset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    this.data = seed();
  }

  async call(action, body, who) {
    await new Promise((r) => setTimeout(r, LATENCY_MS));
    if (this.offline) throw new NetworkError('Demo: offline');
    body = body || {};
    const member = who || 'system';
    const cursor = () => new Date(Date.now() - 10000).toISOString();
    const t = this.data.tables;
    const settingsRows = (since) => Object.keys(this.data.settings)
      .filter(() => !since || this.settingsStamp > since)
      .map((k) => ({ key: k, value: String(this.data.settings[k]), updated_at: this.settingsStamp }));
    const all = (name) => Object.keys(t[name]).map((id) => t[name][id]);

    if (action === 'ping') return { app: 'home-hub', version: 'demo', serverTime: new Date().toISOString() };
    if (action === 'pair.create') return { code: '123456', expiresInSec: 600 };
    if (action === 'pair.redeem') {
      if (body.code !== '123456') throw new ApiError('bad_code', 'That code is wrong or has expired.');
      return { key: 'demo' };
    }
    if (action === 'bootstrap') {
      const tables = {};
      TABLE_NAMES.forEach((n) => { tables[n] = all(n); });
      return { cursor: cursor(), tables: tables, settings: settingsRows('') };
    }
    if (action === 'sync') {
      const rejected = [];
      (body.changes || []).forEach((ch, i) => {
        if (ch.table === 'Settings') {
          this.data.settings[ch.key] = String(ch.value);
          this.settingsStamp = this.data.settingsStamp = new Date().toISOString();
          return;
        }
        if (!t[ch.table]) { rejected.push({ index: i, code: 'unknown_table', message: 'No table ' + ch.table }); return; }
        const id = ch.deleted ? ch.id : ch.row && ch.row.id;
        const now = new Date().toISOString();
        const base = t[ch.table][id] || { id: id, created_at: now, deleted: false };
        const patch = ch.deleted ? { deleted: true } : ch.row;
        t[ch.table][id] = Object.assign({}, base, patch, { updated_at: now, updated_by: member });
      });
      this.persist();
      const since = body.since || '';
      const tables = {};
      TABLE_NAMES.forEach((n) => {
        const changed = all(n).filter((r) => !since || r.updated_at > since);
        if (changed.length) tables[n] = changed;
      });
      return { cursor: cursor(), tables: tables, settings: settingsRows(since), applied: (body.changes || []).length - rejected.length, rejected: rejected };
    }
    if (action === 'completeChore') {
      const c = t.Chores[body.chore_id];
      if (!c) throw new ApiError('not_found', 'No such chore');
      const now = new Date().toISOString();
      const log = { id: 'clg_demo' + Date.now(), created_at: now, updated_at: now, updated_by: member, deleted: false,
        chore_id: c.id, done_at: now, done_by: member, points: 2, skipped: !!body.skipped, due_date: c.next_due };
      t.ChoreLog[log.id] = log;
      t.Chores[c.id] = Object.assign({}, c, { next_due: ymd(new Date(Date.now() + 864e5)), last_done_at: now, updated_at: now });
      this.persist();
      return { chore: t.Chores[c.id], log: log };
    }
    throw new ApiError('unknown_action', 'Demo server does not know ' + action);
  }
}
