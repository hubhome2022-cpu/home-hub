/**
 * Home Hub — scheduled jobs and hand-edit tracking.
 * Run Home Hub › Install nightly jobs once; running it again replaces the old ones.
 */

var TRIGGER_HANDLERS_ = ['handleSheetEdit', 'nightlyMaintenance', 'nightlyBackup'];
var BACKUP_FOLDER_ = 'Home Hub backups';
var BACKUPS_TO_KEEP_ = 30;

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (TRIGGER_HANDLERS_.indexOf(tr.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(tr);
  });
  var ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger('handleSheetEdit').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('nightlyBackup').timeBased().everyDays(1).atHour(1).create();
  ScriptApp.newTrigger('nightlyMaintenance').timeBased().everyDays(1).atHour(2).create();
  try {
    SpreadsheetApp.getUi().alert('Home Hub',
      'Nightly jobs are on: a backup around 1 am and chore due dates around 2 am. ' +
      'Edits you make by hand in the Sheet now sync to the app too.',
      SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) { /* no screen */ }
}

/**
 * Runs when someone edits the Sheet by hand (not when the API writes).
 * Gives new rows an id and stamps updated_at, so devices pick the change up on their next sync.
 */
function handleSheetEdit(e) {
  if (!e || !e.range) return;
  var range = e.range;
  var sh = range.getSheet();
  var name = sh.getName();
  var first = Math.max(range.getRow(), 2);
  var last = range.getLastRow();
  if (last < first) return;
  var now = nowIso_();

  if (name === SETTINGS_TAB) {
    var vals = sh.getRange(first, 1, last - first + 1, 3).getValues();
    vals.forEach(function (r) { if (r[0] !== '') r[2] = now; });
    sh.getRange(first, 1, vals.length, 3).setValues(vals);
    markTableChanged_(name, now);
    return;
  }
  if (!TABLES[name]) return;

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var block = sh.getRange(first, 1, last - first + 1, headers.length);
  var rows = block.getValues();
  var changedIds = [];
  rows.forEach(function (arr) {
    if (isBlankRow_(arr)) return;
    if (get_(headers, arr, 'id') === '') {
      set_(headers, arr, 'id', newId_(name));
      set_(headers, arr, 'created_at', now);
    }
    if (get_(headers, arr, 'deleted') === '') set_(headers, arr, 'deleted', false);
    set_(headers, arr, 'updated_at', now);
    set_(headers, arr, 'updated_by', 'sheet');
    changedIds.push(String(get_(headers, arr, 'id')));
  });
  if (!changedIds.length) return;
  block.setValues(rows);
  markTableChanged_(name, now);

  if (name === 'Chores') {
    var c1 = range.getColumn();
    var c2 = range.getLastColumn();
    var ruleCols = [headers.indexOf('rule') + 1, headers.indexOf('rule_value') + 1];
    var ruleEdited = ruleCols.some(function (c) { return c >= c1 && c <= c2; });
    var lock = LockService.getScriptLock();
    if (lock.tryLock(10000)) {
      try {
        recomputeChores_(changedIds.map(function (id) { return { id: id, force: ruleEdited }; }));
      } finally {
        lock.releaseLock();
      }
    }
  }
}

/** Nightly: chore due dates, and clearing fridge notes past their expiry. */
function nightlyMaintenance() {
  withLock_(function () {
    recomputeChores_(null);
    var now = nowIso_();
    var expired = allRows_('Notes').filter(function (n) {
      return !n.deleted && !n.pinned && n.expires_at && n.expires_at < now;
    }).map(function (n) { return { id: n.id, deleted: true }; });
    if (expired.length) upsertRows_('Notes', expired, 'system');
  });
}

/** Copies the whole spreadsheet into Drive › Home Hub backups and keeps the newest 30 copies. */
function nightlyBackup() {
  var ss = SpreadsheetApp.getActive();
  var folders = DriveApp.getFoldersByName(BACKUP_FOLDER_);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(BACKUP_FOLDER_);
  var stamp = Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HHmm');
  DriveApp.getFileById(ss.getId()).makeCopy(ss.getName() + ' backup ' + stamp, folder);

  var files = [];
  var it = folder.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  // Older copies go to Drive's trash (recoverable there for 30 days), not deleted outright.
  files.slice(BACKUPS_TO_KEEP_).forEach(function (f) { f.setTrashed(true); });
}
