/**
 * Home Hub — reading and writing tabs.
 *
 * Rows are matched by header name, never by position, so columns can be
 * reordered or added in the Sheet without breaking anything.
 */

function apiError_(code, message) {
  var e = new Error(message);
  e.code = code;
  return e;
}

function nowIso_() {
  return new Date().toISOString();
}

var ID_ALPHABET_ = 'abcdefghijkmnpqrstuvwxyz23456789';

function newId_(table) {
  var prefix = TABLES[table].prefix;
  var s = '';
  for (var i = 0; i < 10; i++) s += ID_ALPHABET_.charAt(Math.floor(Math.random() * ID_ALPHABET_.length));
  return prefix + '_' + s;
}

function sheet_(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw apiError_('missing_tab', 'The "' + name + '" tab is missing. Run Home Hub › Set up or repair sheet.');
  return sh;
}

/** Converts one cell value into what the API returns. */
function cellOut_(value, type) {
  if (value instanceof Date) {
    // Someone typed a date into a cell Sheets converted. Hand it back in our format.
    return type === 'd' ? Utilities.formatDate(value, tz_(), 'yyyy-MM-dd') : value.toISOString();
  }
  if (type === 'b') return value === true || value === 'TRUE' || value === 'true';
  if (type === 'n') return value === '' || value === null ? '' : Number(value);
  return value === null || value === undefined ? '' : String(value);
}

/** Converts an incoming API value into what is stored in the cell. */
function cellIn_(value, type, column) {
  if (value === undefined || value === null) return '';
  if (type === 'b') return value === true || value === 'TRUE' || value === 'true';
  if (type === 'n') {
    if (value === '') return '';
    var n = Number(value);
    if (isNaN(n)) throw apiError_('bad_value', column + ' must be a number.');
    return n;
  }
  if (Object.prototype.toString.call(type) === '[object Array]') {
    if (value !== '' && type.indexOf(value) === -1) {
      throw apiError_('bad_value', column + ' must be one of: ' + type.join(', ') + '.');
    }
    return value;
  }
  if (type === 'd' && value !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw apiError_('bad_value', column + ' must be a date like 2026-10-17.');
  }
  if (type === 'list' && Object.prototype.toString.call(value) === '[object Array]') return value.join(', ');
  if (type === 'lines' && Object.prototype.toString.call(value) === '[object Array]') return value.join('\n');
  return String(value);
}

/**
 * Reads a whole tab.
 * Returns { sh, headers, rows (2-D values, no header), index: id -> 0-based row number in rows }.
 */
function readTable_(name) {
  var sh = sheet_(name);
  var values = sh.getDataRange().getValues();
  var headers = values.length ? values.shift().map(String) : [];
  var idCol = headers.indexOf('id');
  var index = {};
  if (idCol !== -1) {
    for (var i = 0; i < values.length; i++) {
      var id = values[i][idCol];
      if (id !== '' && id !== null) index[String(id)] = i;
    }
  }
  return { sh: sh, headers: headers, rows: values, index: index };
}

function rowToObj_(name, headers, arr) {
  var types = columnTypes_(name);
  var obj = {};
  for (var c = 0; c < headers.length; c++) {
    var h = headers[c];
    if (!types[h]) continue; // a column you added by hand stays in the Sheet only
    obj[h] = cellOut_(arr[c], types[h]);
  }
  return obj;
}

/** True when a row has nothing in it. An unticked checkbox (FALSE) counts as empty. */
function isBlankRow_(arr) {
  for (var i = 0; i < arr.length; i++) if (arr[i] !== '' && arr[i] !== null && arr[i] !== false) return false;
  return true;
}

/** Number of data rows (below the header) up to the last one with anything in it. */
function usedRowCount_(rows) {
  for (var i = rows.length - 1; i >= 0; i--) if (!isBlankRow_(rows[i])) return i + 1;
  return 0;
}

/** All rows as objects. Rows with no id (half-typed by hand) are skipped. */
function allRows_(name) {
  var t = readTable_(name);
  var idCol = t.headers.indexOf('id');
  var out = [];
  t.rows.forEach(function (arr) {
    if (isBlankRow_(arr) || arr[idCol] === '') return;
    out.push(rowToObj_(name, t.headers, arr));
  });
  return out;
}

function rowsChangedSince_(name, since) {
  if (since && !tableChangedSince_(name, since)) return [];
  return allRows_(name).filter(function (r) { return !since || String(r.updated_at) > since; });
}

/**
 * Inserts or updates rows. Each obj may be partial: only the fields it carries are changed.
 * The server stamps created_at / updated_at / updated_by. Returns the saved rows.
 * Caller must hold the script lock.
 */
function upsertRows_(name, objs, memberId) {
  if (!objs.length) return [];
  var t = readTable_(name);
  var types = columnTypes_(name);
  var prefix = TABLES[name].prefix + '_';
  var now = nowIso_();
  var saved = [];
  var appends = [];
  var origLen = t.rows.length;
  // Not sh.getLastRow(): every row has a checkbox, and Sheets counts an unticked one as data.
  var firstFreeRow = usedRowCount_(t.rows) + 2;

  objs.forEach(function (obj) {
    if (!obj || typeof obj !== 'object') throw apiError_('bad_row', 'Each row must be an object.');
    var id = obj.id ? String(obj.id) : newId_(name);
    if (id.indexOf(prefix) !== 0) throw apiError_('bad_id', 'Ids in ' + name + ' must start with "' + prefix + '".');
    var at = t.index[id];
    var arr = at === undefined ? t.headers.map(function () { return ''; }) : t.rows[at].slice();

    Object.keys(obj).forEach(function (key) {
      if (key === 'id' || key === 'created_at' || key === 'updated_at' || key === 'updated_by') return;
      if (!types[key]) throw apiError_('unknown_column', name + ' has no column "' + key + '".');
      var col = t.headers.indexOf(key);
      if (col === -1) throw apiError_('missing_column', 'The ' + name + ' tab is missing "' + key + '". Run Home Hub › Set up or repair sheet.');
      arr[col] = cellIn_(obj[key], types[key], key);
    });
    set_(t.headers, arr, 'id', id);
    if (at === undefined) {
      set_(t.headers, arr, 'created_at', now);
      if (get_(t.headers, arr, 'deleted') === '') set_(t.headers, arr, 'deleted', false);
    }
    set_(t.headers, arr, 'updated_at', now);
    set_(t.headers, arr, 'updated_by', memberId || 'system');

    if (at === undefined) {
      t.index[id] = t.rows.length;
      t.rows.push(arr);
      appends.push(arr);
    } else if (at >= origLen) {
      // The same new row appeared twice in one batch: update the pending append.
      t.rows[at] = arr;
      appends[at - origLen] = arr;
    } else {
      t.rows[at] = arr;
      t.sh.getRange(at + 2, 1, 1, arr.length).setValues([arr]);
    }
    saved.push(rowToObj_(name, t.headers, arr));
  });

  if (appends.length) {
    var start = firstFreeRow;
    var spare = t.sh.getMaxRows() - start + 1;
    // New rows copy the formatting and dropdowns of the row above them.
    if (spare < appends.length) t.sh.insertRowsAfter(t.sh.getMaxRows(), appends.length - spare + 500);
    t.sh.getRange(start, 1, appends.length, t.headers.length).setValues(appends);
  }
  markTableChanged_(name, now);
  return saved;
}

function softDelete_(name, id, memberId) {
  return upsertRows_(name, [{ id: id, deleted: true }], memberId)[0];
}

function get_(headers, arr, col) {
  var i = headers.indexOf(col);
  return i === -1 ? '' : arr[i];
}

function set_(headers, arr, col, value) {
  var i = headers.indexOf(col);
  if (i !== -1) arr[i] = value;
}

/* ---------- Settings (key/value tab) ---------- */

function readSettings_() {
  var sh = sheet_(SETTINGS_TAB);
  var values = sh.getDataRange().getValues();
  values.shift();
  var out = {};
  values.forEach(function (r) {
    if (r[0] !== '') out[String(r[0])] = r[1] instanceof Date ? r[1].toISOString() : String(r[1]);
  });
  return out;
}

function settingsRowsChangedSince_(since) {
  if (since && !tableChangedSince_(SETTINGS_TAB, since)) return [];
  var sh = sheet_(SETTINGS_TAB);
  var values = sh.getDataRange().getValues();
  values.shift();
  return values.filter(function (r) {
    return r[0] !== '' && (!since || String(r[2]) > since);
  }).map(function (r) {
    return { key: String(r[0]), value: String(r[1]), updated_at: String(r[2]) };
  });
}

/** Caller must hold the script lock. */
function setSettings_(pairs) {
  var sh = sheet_(SETTINGS_TAB);
  var values = sh.getDataRange().getValues();
  var now = nowIso_();
  Object.keys(pairs).forEach(function (key) {
    if (!/^[a-z0-9_]{1,64}$/.test(key)) throw apiError_('bad_key', 'Setting names use lower-case letters, digits and _.');
    var found = -1;
    for (var i = 1; i < values.length; i++) if (String(values[i][0]) === key) { found = i; break; }
    var row = [key, String(pairs[key]), now];
    if (found === -1) {
      sh.appendRow(row);
      values.push(row);
    } else {
      sh.getRange(found + 1, 1, 1, 3).setValues([row]);
    }
  });
  markTableChanged_(SETTINGS_TAB, now);
}

var tzCache_ = null;
function tz_() {
  if (tzCache_) return tzCache_;
  try {
    tzCache_ = readSettings_().timezone || Session.getScriptTimeZone();
  } catch (e) {
    tzCache_ = Session.getScriptTimeZone();
  }
  return tzCache_;
}

/* ---------- Change tracking, so sync can skip untouched tabs ---------- */

function markTableChanged_(name, iso) {
  PropertiesService.getScriptProperties().setProperty('changed:' + name, iso || nowIso_());
}

function tableChangedSince_(name, since) {
  var last = PropertiesService.getScriptProperties().getProperty('changed:' + name);
  return !last || last > since;
}
