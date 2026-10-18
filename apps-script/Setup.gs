/**
 * Home Hub — building and repairing the spreadsheet, plus the Home Hub menu.
 * Everything here is safe to run again: it adds what is missing and never
 * deletes or reorders your data.
 */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Home Hub')
    .addItem('Set up or repair sheet', 'setupSheet')
    .addItem('Load starter data', 'loadStarterData')
    .addSeparator()
    .addItem('Load sample data', 'loadSampleData')
    .addItem('Remove sample data', 'removeSampleData')
    .addSeparator()
    .addItem('Install nightly jobs', 'installTriggers')
    .addItem('Recompute chore due dates', 'recomputeAllChores')
    .addItem('Back up now', 'nightlyBackup')
    .addSeparator()
    .addItem('Show household key', 'showHouseholdKey')
    .addItem('Make a new household key', 'rotateHouseholdKey')
    .addToUi();
}

function setupSheet() {
  var ss = SpreadsheetApp.getActive();
  ensureSettingsTab_(ss);
  TABLE_ORDER.forEach(function (name) { ensureTableTab_(ss, name); });
  // Dropdowns that read other tabs need those tabs to exist first, so do them last.
  TABLE_ORDER.forEach(function (name) { applyRangeDropdowns_(ss, name); });
  var moved = 0;
  TABLE_ORDER.forEach(function (name) { moved += closeGaps_(ss.getSheetByName(name)); });

  var blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);

  var madeKey = ensureHouseholdKey_();
  var msg = 'All ' + (TABLE_ORDER.length + 1) + ' tabs are ready.';
  if (moved) msg += '\n\n' + moved + ' row(s) that had landed far down a tab were moved back up under the header.';
  if (madeKey) msg += '\n\nA household key was created. Use Home Hub › Show household key when you set up the app.';
  msg += '\n\nNext: Home Hub › Load starter data, then Install nightly jobs.';
  SpreadsheetApp.getUi().alert('Home Hub', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

function ensureSettingsTab_(ss) {
  var sh = ss.getSheetByName(SETTINGS_TAB) || ss.insertSheet(SETTINGS_TAB, 0);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, SETTINGS_COLUMNS.length).setValues([SETTINGS_COLUMNS]);
  styleHeader_(sh, SETTINGS_COLUMNS.length);
  sh.getRange(2, 1, sh.getMaxRows() - 1, 3).setNumberFormat('@');

  var have = readSettings_();
  var missing = {};
  SETTINGS_DEFAULTS.forEach(function (p) { if (!(p[0] in have)) missing[p[0]] = p[1]; });
  if (Object.keys(missing).length) setSettings_(missing);
}

function ensureTableTab_(ss, name) {
  var cols = tableColumns_(name);
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);

  var lastCol = sh.getLastColumn();
  var headers = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  var toAdd = cols.map(function (c) { return c[0]; }).filter(function (h) { return headers.indexOf(h) === -1; });
  if (toAdd.length) {
    if (sh.getMaxColumns() < headers.length + toAdd.length) {
      sh.insertColumnsAfter(sh.getMaxColumns(), headers.length + toAdd.length - sh.getMaxColumns());
    }
    sh.getRange(1, headers.length + 1, 1, toAdd.length).setValues([toAdd]);
    headers = headers.concat(toAdd);
  }
  styleHeader_(sh, headers.length);

  var rows = sh.getMaxRows() - 1;
  cols.forEach(function (c) {
    var col = headers.indexOf(c[0]) + 1;
    var range = sh.getRange(2, col, rows, 1);
    var type = c[1];
    if (type === 'b') {
      range.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
    } else if (type === 'n') {
      // Numbers keep Sheets' automatic format.
    } else if (Object.prototype.toString.call(type) === '[object Array]') {
      range.setNumberFormat('@');
      range.setDataValidation(SpreadsheetApp.newDataValidation()
        .requireValueInList(type, true).setAllowInvalid(false).build());
    } else {
      // Text, ids, dates and timestamps are stored as plain text so Sheets never reformats them.
      range.setNumberFormat('@');
    }
  });
  markTableChanged_(name);
}

function applyRangeDropdowns_(ss, name) {
  var sh = ss.getSheetByName(name);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  tableColumns_(name).forEach(function (c) {
    if (!c[1] || !c[1].range) return;
    var src = ss.getSheetByName(c[1].range);
    var srcHeaders = src.getRange(1, 1, 1, src.getLastColumn()).getValues()[0].map(String);
    var nameCol = srcHeaders.indexOf('name') + 1;
    var srcRange = src.getRange(2, nameCol, src.getMaxRows() - 1, 1);
    // A warning, not a hard block: a room typed before it exists in Rooms shouldn't stop a save.
    sh.getRange(2, headers.indexOf(c[0]) + 1, sh.getMaxRows() - 1, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInRange(srcRange, true).setAllowInvalid(true).build());
  });
}

/**
 * Moves rows up so there are no empty rows between the header and the data.
 * (Early versions added rows at 1001 and below.) Returns how many rows moved.
 */
function closeGaps_(sh) {
  var last = sh.getLastRow();
  var width = sh.getLastColumn();
  if (last < 2 || !width) return 0;
  var range = sh.getRange(2, 1, last - 1, width);
  var values = range.getValues();
  var keep = values.filter(function (r) { return !isBlankRow_(r); });
  var firstGap = -1;
  for (var i = 0; i < keep.length; i++) if (isBlankRow_(values[i])) { firstGap = i; break; }
  if (firstGap === -1) return 0;
  var moved = keep.length - firstGap;
  range.clearContent();
  sh.getRange(2, 1, keep.length, width).setValues(keep);
  markTableChanged_(sh.getName());
  return moved;
}

function styleHeader_(sh, width) {
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, width).setFontWeight('bold').setBackground('#F3F1EE');
}

/* ---------- Household key ---------- */

function ensureHouseholdKey_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('HOUSEHOLD_KEY')) return false;
  props.setProperty('HOUSEHOLD_KEY', randomKey_());
  return true;
}

function randomKey_() {
  // Two UUIDs give 244 random bits; hex keeps it easy to copy.
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

function showHouseholdKey() {
  ensureHouseholdKey_();
  var key = PropertiesService.getScriptProperties().getProperty('HOUSEHOLD_KEY');
  SpreadsheetApp.getUi().alert('Household key',
    key + '\n\nEnter this once on each device when the app asks for it. Keep it private: ' +
    'anyone with this key and the app address can read and change your hub data.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function rotateHouseholdKey() {
  var ui = SpreadsheetApp.getUi();
  var ok = ui.alert('Make a new household key?',
    'Every device (the fridge and both phones) will need the new key before it can sync again.',
    ui.ButtonSet.OK_CANCEL);
  if (ok !== ui.Button.OK) return;
  PropertiesService.getScriptProperties().setProperty('HOUSEHOLD_KEY', randomKey_());
  showHouseholdKey();
}
