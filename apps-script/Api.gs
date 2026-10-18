/**
 * Home Hub — web API.
 *
 * Deploy as a web app: Execute as "Me", Who has access "Anyone".
 * The app POSTs JSON with Content-Type text/plain (no CORS preflight):
 *   { "key": "<household key>", "action": "sync", "member": "mem_jeremy", ... }
 * Every response is { ok: true, data: … } or { ok: false, error: { code, message } }.
 * The key travels only in the POST body, never in the URL.
 */

var SYNC_OVERLAP_MS_ = 10 * 1000; // re-send the last 10 s each sync so no edit slips between cursors

var ROUTES_ = {
  'ping': apiPing_,
  'bootstrap': apiBootstrap_,
  'sync': apiSync_,
  'upsert': apiUpsert_,
  'delete': apiDelete_,
  'completeChore': apiCompleteChore_,
  'pair.create': apiPairCreate_
};

/** The only action that works without the key: trading a pairing code for it. */
var PUBLIC_ROUTES_ = {
  'pair.redeem': apiPairRedeem_
};

var PAIR_TTL_SEC_ = 600;
var PAIR_MAX_FAILS_ = 10;

function doGet() {
  // No data here: just proof the deployment is alive.
  return json_({ ok: true, data: { app: 'home-hub', version: API_VERSION } });
}

function doPost(e) {
  try {
    var body = e && e.postData && e.postData.contents;
    var req;
    try {
      req = JSON.parse(body || '{}');
    } catch (parseErr) {
      throw apiError_('bad_json', 'The request body is not valid JSON.');
    }
    req.member = cleanMember_(req.member);
    if (PUBLIC_ROUTES_[req.action]) return json_({ ok: true, data: PUBLIC_ROUTES_[req.action](req) });
    checkKey_(req.key);
    var handler = ROUTES_[req.action];
    if (!handler) throw apiError_('unknown_action', 'Unknown action "' + req.action + '".');
    return json_({ ok: true, data: handler(req) });
  } catch (err) {
    if (!err.code) console.error(err && err.stack || err);
    return json_({ ok: false, error: { code: err.code || 'server_error', message: String(err.message || err) } });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkKey_(given) {
  var real = PropertiesService.getScriptProperties().getProperty('HOUSEHOLD_KEY');
  if (!real) throw apiError_('not_set_up', 'Run Home Hub › Set up or repair sheet first.');
  given = String(given || '');
  // Compare every character so timing doesn't reveal how much of the key matched.
  var diff = given.length ^ real.length;
  for (var i = 0; i < real.length; i++) diff |= real.charCodeAt(i) ^ (given.charCodeAt(i) || 0);
  if (diff !== 0) throw apiError_('bad_key', 'The household key is wrong.');
}

function cleanMember_(m) {
  m = String(m || 'system');
  return /^[a-z0-9_]{1,40}$/.test(m) ? m : 'system';
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw apiError_('busy', 'The hub is busy. Try again in a moment.');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function cursor_() {
  return new Date(Date.now() - SYNC_OVERLAP_MS_).toISOString();
}

/* ---------- Actions ---------- */

function apiPing_() {
  return { app: 'home-hub', version: API_VERSION, serverTime: nowIso_() };
}

/** Everything, for a device's first sync. Includes soft-deleted rows so devices can drop them. */
function apiBootstrap_() {
  var cursor = cursor_();
  var tables = {};
  TABLE_ORDER.forEach(function (name) { tables[name] = allRows_(name); });
  return { cursor: cursor, tables: tables, settings: settingsRowsChangedSince_('') };
}

/**
 * Applies a device's queued changes in order, then returns everything changed since `since`.
 * changes: [ { table, row } | { table, id, deleted: true } | { table: 'Settings', key, value } ]
 * A change that fails is reported in `rejected` (by index) and skipped; the rest still apply,
 * so one bad edit can never block a device's queue.
 */
function apiSync_(req) {
  var since = String(req.since || '');
  if (since && !/^\d{4}-\d{2}-\d{2}T/.test(since)) throw apiError_('bad_since', '"since" must be a cursor from an earlier sync.');
  var changes = req.changes || [];
  if (changes.length > 500) throw apiError_('too_many', 'Send at most 500 changes per sync.');

  return withLock_(function () {
    var rejected = [];
    var touchedChores = [];
    changes.forEach(function (ch, i) {
      try {
        applyChange_(ch, req.member, touchedChores);
      } catch (err) {
        if (!err.code) throw err;
        rejected.push({ index: i, code: err.code, message: err.message });
      }
    });
    if (touchedChores.length) recomputeChores_(touchedChores);

    var cursor = cursor_();
    var tables = {};
    TABLE_ORDER.forEach(function (name) {
      var rows = rowsChangedSince_(name, since);
      if (rows.length) tables[name] = rows;
    });
    return {
      cursor: cursor,
      tables: tables,
      settings: settingsRowsChangedSince_(since),
      applied: changes.length - rejected.length,
      rejected: rejected
    };
  });
}

function applyChange_(ch, member, touchedChores) {
  if (!ch || typeof ch !== 'object') throw apiError_('bad_change', 'Each change must be an object.');
  if (ch.table === SETTINGS_TAB) {
    var pair = {};
    pair[String(ch.key)] = ch.value === undefined ? '' : ch.value;
    setSettings_(pair);
    return null;
  }
  if (!TABLES[ch.table]) throw apiError_('unknown_table', 'There is no table named "' + ch.table + '".');
  var row = ch.deleted === true && ch.id ? { id: ch.id, deleted: true } : ch.row;
  var saved = upsertRows_(ch.table, [row], member)[0];
  if (ch.table === 'Chores') {
    var ruleChanged = !!(row && ('rule' in row || 'rule_value' in row));
    touchedChores.push({ id: saved.id, force: ruleChanged });
  }
  return saved;
}

/** One row (or one setting: { table: 'Settings', setting, value }). Returns the saved row. */
function apiUpsert_(req) {
  return withLock_(function () {
    var touched = [];
    var saved = applyChange_({ table: req.table, row: req.row, key: req.setting, value: req.value }, req.member, touched);
    if (req.table === SETTINGS_TAB) return readSettings_();
    if (touched.length) {
      recomputeChores_(touched);
      return findRow_(req.table, saved.id);
    }
    return saved;
  });
}

function apiDelete_(req) {
  if (!req.id) throw apiError_('bad_id', 'Send the id of the row to delete.');
  return withLock_(function () {
    if (!TABLES[req.table]) throw apiError_('unknown_table', 'There is no table named "' + req.table + '".');
    if (readTable_(req.table).index[req.id] === undefined) throw apiError_('not_found', 'No row with id ' + req.id + '.');
    return softDelete_(req.table, req.id, req.member);
  });
}

function apiCompleteChore_(req) {
  if (!req.chore_id) throw apiError_('bad_id', 'Send chore_id.');
  return withLock_(function () {
    return completeChore_(String(req.chore_id), req.member, req.skipped === true, String(req.note || ''), req.done_at);
  });
}

/* ---------- Pairing a new device ----------
 * A device that already has the key asks for a 6-digit code (valid 10 minutes, one use).
 * The new device sends the code and gets the key back, so nobody types a 64-character key
 * on the fridge. After 10 wrong codes in 10 minutes, all codes stop working until the
 * window passes, which makes guessing hopeless.
 */

function apiPairCreate_() {
  var cache = CacheService.getScriptCache();
  var code;
  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
  } while (cache.get('pair:' + code));
  cache.put('pair:' + code, '1', PAIR_TTL_SEC_);
  return { code: code, expiresInSec: PAIR_TTL_SEC_ };
}

function apiPairRedeem_(req) {
  var code = String(req.code || '');
  if (!/^\d{6}$/.test(code)) throw apiError_('bad_code', 'Pairing codes are 6 digits.');
  return withLock_(function () {
    var cache = CacheService.getScriptCache();
    var fails = Number(cache.get('pair:fails') || 0);
    if (fails >= PAIR_MAX_FAILS_) throw apiError_('too_many_attempts', 'Too many wrong codes. Wait 10 minutes, then make a new code.');
    if (!cache.get('pair:' + code)) {
      cache.put('pair:fails', String(fails + 1), PAIR_TTL_SEC_);
      throw apiError_('bad_code', 'That code is wrong or has expired.');
    }
    cache.remove('pair:' + code);
    return { key: PropertiesService.getScriptProperties().getProperty('HOUSEHOLD_KEY') };
  });
}

function findRow_(table, id) {
  if (!id) return null;
  var t = readTable_(table);
  var at = t.index[id];
  return at === undefined ? null : rowToObj_(table, t.headers, t.rows[at]);
}
