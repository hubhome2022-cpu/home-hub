// Tests for the chore scheduling math in apps-script/Chores.gs.
// Run on Windows (no installs needed):
//   cscript //nologo //E:jscript tests\chores_test.js
// It also loads every other .gs file, which doubles as a syntax check.

var fso = new ActiveXObject('Scripting.FileSystemObject');
var root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName));
var files = ['Schema.gs', 'Store.gs', 'Setup.gs', 'Api.gs', 'Chores.gs', 'Triggers.gs', 'Seed.gs'];
for (var f = 0; f < files.length; f++) {
  var path = root + '\\apps-script\\' + files[f];
  var src = fso.OpenTextFile(path, 1, false, -2).ReadAll();
  try {
    (0, eval)(src);
  } catch (e) {
    WScript.Echo('SYNTAX/LOAD ERROR in ' + files[f] + ': ' + e.message);
    WScript.Quit(1);
  }
}

var passed = 0;
var failed = 0;
function eq(label, got, want) {
  if (got === want) { passed++; return; }
  failed++;
  WScript.Echo('FAIL ' + label + ': got "' + got + '", want "' + want + '"');
}

var today = '2026-10-17'; // a Saturday

eq('weekday of today', weekday_(today), 6);
eq('year rollover', addDays_('2026-12-31', 1), '2027-01-01');
eq('leap day', addDays_('2028-02-28', 1), '2028-02-29');

eq('daily, never done', choreNextDue_('daily', '', '', today), today);
eq('daily, done today', choreNextDue_('daily', '', today, today), '2026-10-18');

eq('every 90, done today', choreNextDue_('every_n_days', '90', today, today), '2027-01-15');
eq('every N, bad value -> 1', choreNextDue_('every_n_days', '', today, today), '2026-10-18');
eq('every 14, never done', choreNextDue_('every_n_days', '14', '', today), today);

eq('weekly TU, never done', choreNextDue_('weekly', 'TU', '', today), '2026-10-20');
eq('weekly TU, done Monday early', choreNextDue_('weekly', 'TU', choreBase_('weekly', '2026-10-19', '2026-10-20'), today), '2026-10-27');
eq('weekly TU, done 4 days late', choreNextDue_('weekly', 'TU', choreBase_('weekly', '2026-10-24', '2026-10-20'), today), '2026-10-27');
eq('weekly WE,SA, never done on a Saturday', choreNextDue_('weekly', 'WE, SA', '', today), today);
eq('weekly WE,SA, done Saturday', choreNextDue_('weekly', 'we,sa', today, today), '2026-10-21');
eq('weekly, no days -> every 7', choreNextDue_('weekly', '', today, today), '2026-10-24');

eq('monthly 1, never done', choreNextDue_('monthly', '1', '', today), '2026-11-01');
eq('monthly 1, done on time', choreNextDue_('monthly', '1', choreBase_('monthly', '2026-10-01', '2026-10-01'), today), '2026-11-01');
eq('monthly 1, done 2 days early', choreNextDue_('monthly', '1', choreBase_('monthly', '2026-09-29', '2026-10-01'), today), '2026-11-01');
eq('monthly 31 in February', choreNextDue_('monthly', '31', '2026-01-31', today), '2026-02-28');
eq('monthly 17, never done, today is the 17th', choreNextDue_('monthly', '17', '', today), today);

eq('seasonal, never done, inside window', choreNextDue_('seasonal', '10-15..11-15', '', today), '2026-10-15');
eq('seasonal, done this season', choreNextDue_('seasonal', '10-15..11-15', '2026-10-16', today), '2027-10-15');
eq('seasonal, done last year', choreNextDue_('seasonal', '10-15..11-15', '2025-11-01', today), '2026-10-15');
eq('seasonal, window passed, never done', choreNextDue_('seasonal', '10-15..11-15', '', '2026-12-01'), '2027-10-15');
eq('seasonal, wraps the new year', choreNextDue_('seasonal', '12-01..02-28', '', '2026-01-10'), '2025-12-01');
eq('seasonal, wraps, done in December', choreNextDue_('seasonal', '12-01..02-28', '2025-12-05', '2026-01-10'), '2026-12-01');

eq('once with date, never done', choreNextDue_('once', '2026-11-01', '', today), '2026-11-01');
eq('once, done', choreNextDue_('once', '2026-11-01', '2026-11-01', today), '');

eq('daily base ignores covered due', choreBase_('daily', '2026-10-17', '2026-10-15'), '2026-10-17');

var both = 'mem_jeremy, mem_allison';
eq('rotate advances', choreNextAssignee_('rotate', both, 'mem_jeremy', true), 'mem_allison');
eq('rotate wraps around', choreNextAssignee_('rotate', both, 'mem_allison', true), 'mem_jeremy');
eq('rotate holds on skip', choreNextAssignee_('rotate', both, 'mem_jeremy', false), 'mem_jeremy');
eq('rotate starts at first', choreNextAssignee_('rotate', both, '', false), 'mem_jeremy');
eq('fixed is first', choreNextAssignee_('fixed', 'mem_allison', '', true), 'mem_allison');
eq('anyone is blank', choreNextAssignee_('anyone', both, '', true), '');

eq('points from minutes', chorePoints_('', 10, '0.2'), 2);
eq('points minimum 1', chorePoints_('', 3, '0.2'), 1);
eq('points override', chorePoints_(5, 10, '0.2'), 5);

eq('slug', slug_("Scout's heartworm prevention"), 'scout_heartworm_prevention');
eq('slug with &', slug_('Meat & seafood'), 'meat_seafood');

eq('unticked checkbox row is blank', isBlankRow_(['', false, '', false]), true);
eq('ticked checkbox row is not blank', isBlankRow_(['', true, '']), false);
eq('used rows skip trailing checkbox-only rows', usedRowCount_([['a', false], ['', false], ['b', false], ['', false], ['', false]]), 3);
eq('used rows of an empty tab', usedRowCount_([['', false], ['', false]]), 0);

WScript.Echo(passed + ' passed, ' + failed + ' failed');
WScript.Quit(failed ? 1 : 0);
