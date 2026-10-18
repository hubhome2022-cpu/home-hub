/**
 * Home Hub — chore scheduling.
 *
 * How "next due" works:
 *  - daily / every_n_days count from the day it was last done (or skipped).
 *    Replace the furnace filter late and the next one is 90 days after that.
 *  - weekly / monthly / seasonal follow the calendar, and a completion takes care
 *    of the due date it was done for. Take the trash out on Monday for Tuesday's
 *    pickup and it isn't due again until next Tuesday; take it out four days late
 *    and it doesn't pile up.
 *  - once: due on the date in rule_value (or right away), then never again.
 *
 * The first block is plain date math with no Google services, written in old-style
 * JavaScript so it can be tested on Windows with `cscript` (see tests/).
 */

var WEEKDAY_CODES_ = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
var ANCHORED_RULES_ = { weekly: true, monthly: true, seasonal: true };

function pad2_(n) { return (n < 10 ? '0' : '') + n; }

/** 'YYYY-MM-DD' -> Date at 12:00 UTC (noon keeps day math clear of DST edges). */
function ymdToDate_(s) {
  var p = String(s).split('-');
  return new Date(Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 12));
}

function dateToYmd_(d) {
  return d.getUTCFullYear() + '-' + pad2_(d.getUTCMonth() + 1) + '-' + pad2_(d.getUTCDate());
}

function addDays_(s, n) {
  var d = ymdToDate_(s);
  d.setUTCDate(d.getUTCDate() + n);
  return dateToYmd_(d);
}

function weekday_(s) { return ymdToDate_(s).getUTCDay(); }

function daysInMonth_(y, m) { return new Date(Date.UTC(y, m, 0, 12)).getUTCDate(); }

function maxYmd_(a, b) { return !a ? b : (!b ? a : (a > b ? a : b)); }

function trim_(s) { return String(s === null || s === undefined ? '' : s).replace(/^\s+|\s+$/g, ''); }

/** 'MO, th' -> { 1: true, 4: true }, or null when nothing valid is listed. */
function parseWeekdays_(value) {
  var parts = trim_(value).toUpperCase().split(/[\s,]+/);
  var out = {};
  var any = false;
  for (var i = 0; i < parts.length; i++) {
    for (var d = 0; d < 7; d++) {
      if (parts[i].substring(0, 2) === WEEKDAY_CODES_[d]) { out[d] = true; any = true; }
    }
  }
  return any ? out : null;
}

/** '10-15..11-15' -> { sm, sd, em, ed } or null. */
function parseSeason_(value) {
  var m = /^(\d{1,2})-(\d{1,2})\s*\.\.\s*(\d{1,2})-(\d{1,2})$/.exec(trim_(value));
  if (!m) return null;
  return { sm: parseInt(m[1], 10), sd: parseInt(m[2], 10), em: parseInt(m[3], 10), ed: parseInt(m[4], 10) };
}

function seasonWindow_(season, year) {
  var wraps = season.em < season.sm || (season.em === season.sm && season.ed < season.sd);
  return {
    start: year + '-' + pad2_(season.sm) + '-' + pad2_(season.sd),
    end: (wraps ? year + 1 : year) + '-' + pad2_(season.em) + '-' + pad2_(season.ed)
  };
}

/**
 * Next due date for a chore.
 *   rule, value  the chore's rule and rule_value
 *   base         '' if never done; otherwise the date the last completion counts from
 *                (for anchored rules: the later of the day it was done and the due date it covered)
 *   today        today's date in the household time zone
 * Returns 'YYYY-MM-DD', or '' when the chore is finished for good (a done "once" chore).
 */
function choreNextDue_(rule, value, base, today) {
  value = trim_(value);
  var n, start, i, d;

  if (rule === 'daily') return base ? addDays_(base, 1) : today;

  if (rule === 'every_n_days') {
    n = parseInt(value, 10);
    if (!(n > 0)) n = 1;
    return base ? addDays_(base, n) : today;
  }

  if (rule === 'weekly') {
    var days = parseWeekdays_(value);
    if (!days) return base ? addDays_(base, 7) : today;
    start = base ? addDays_(base, 1) : today;
    for (i = 0; i < 7; i++) {
      d = addDays_(start, i);
      if (days[weekday_(d)]) return d;
    }
  }

  if (rule === 'monthly') {
    var dom = parseInt(value, 10);
    if (!(dom >= 1 && dom <= 31)) dom = 1;
    start = base ? addDays_(base, 1) : today;
    var sd = ymdToDate_(start);
    var y = sd.getUTCFullYear();
    var mo = sd.getUTCMonth() + 1;
    for (i = 0; i < 3; i++) {
      d = y + '-' + pad2_(mo) + '-' + pad2_(Math.min(dom, daysInMonth_(y, mo)));
      if (d >= start) return d;
      mo += 1;
      if (mo > 12) { mo = 1; y += 1; }
    }
  }

  if (rule === 'seasonal') {
    var season = parseSeason_(value);
    if (!season) return base ? addDays_(base, 365) : today;
    var ty = ymdToDate_(today).getUTCFullYear();
    for (var yr = ty - 1; yr <= ty + 2; yr++) {
      var w = seasonWindow_(season, yr);
      var doneThisSeason = base && base >= w.start;
      if (w.end >= today && !doneThisSeason) return w.start;
    }
    return '';
  }

  if (rule === 'once') {
    if (base) return '';
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today;
  }

  return base ? addDays_(base, 1) : today;
}

/** The date a completion counts from. */
function choreBase_(rule, doneYmd, coveredDue) {
  return ANCHORED_RULES_[rule] ? maxYmd_(doneYmd, coveredDue) : doneYmd;
}

function chorePoints_(points, estMin, perMinute) {
  var p = Number(points);
  if (p > 0) return p;
  var est = Number(estMin) || 0;
  var per = Number(perMinute);
  if (!(per > 0)) per = 0.2;
  return Math.max(1, Math.round(est * per));
}

/** Who is up next. `advance` moves a rotation one step (after a real completion, not a skip). */
function choreNextAssignee_(mode, assignees, current, advance) {
  var list = trim_(assignees) ? trim_(assignees).split(/\s*,\s*/) : [];
  if (mode === 'anyone' || !list.length) return '';
  if (mode !== 'rotate') return list[0];
  var at = -1;
  for (var i = 0; i < list.length; i++) if (list[i] === current) at = i;
  if (at === -1) return list[0];
  return advance ? list[(at + 1) % list.length] : list[at];
}

/* ---------- Sheet-bound parts (need Google services) ---------- */

function todayLocal_() {
  return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd');
}

function localYmd_(iso) {
  return Utilities.formatDate(new Date(iso), tz_(), 'yyyy-MM-dd');
}

/** Marks a chore done (or skipped). Caller must hold the script lock. */
function completeChore_(choreId, member, skipped, note, doneAt) {
  var t = readTable_('Chores');
  var at = t.index[choreId];
  if (at === undefined) throw apiError_('not_found', 'No chore with id ' + choreId + '.');
  var chore = rowToObj_('Chores', t.headers, t.rows[at]);
  if (chore.deleted) throw apiError_('deleted', 'That chore was deleted.');

  var when = doneAt && !isNaN(new Date(doneAt).getTime()) ? new Date(doneAt).toISOString() : nowIso_();
  var doneYmd = localYmd_(when);
  var covered = chore.next_due || doneYmd;
  var settings = readSettings_();
  var points = skipped ? 0 : chorePoints_(chore.points, chore.est_min, settings.points_per_minute);

  var log = upsertRows_('ChoreLog', [{
    chore_id: choreId, done_at: when, done_by: member, points: points,
    skipped: skipped, note: note, due_date: covered
  }], member)[0];

  var update = {
    id: choreId,
    next_due: choreNextDue_(chore.rule, chore.rule_value, choreBase_(chore.rule, doneYmd, covered), todayLocal_()),
    next_assignee: choreNextAssignee_(chore.assign_mode, chore.assignees, chore.next_assignee, !skipped)
  };
  if (!skipped) update.last_done_at = when;
  var saved = upsertRows_('Chores', [update], member)[0];
  return { chore: saved, log: log };
}

/**
 * Brings next_due / last_done_at / next_assignee up to date from ChoreLog.
 *   items  null for every chore, or a list of ids / { id, force } objects.
 *   force  recompute next_due even for a never-done chore that already has one
 *          (used when its rule changed).
 * Caller must hold the script lock (the nightly job takes it itself).
 */
function recomputeChores_(items) {
  var wanted = null;
  if (items) {
    wanted = {};
    items.forEach(function (it) {
      var id = typeof it === 'string' ? it : it.id;
      wanted[id] = wanted[id] || (typeof it === 'object' && it.force === true);
    });
  }

  var latest = {};
  var lastDone = {};
  allRows_('ChoreLog').forEach(function (l) {
    if (l.deleted) return;
    if (!latest[l.chore_id] || l.done_at > latest[l.chore_id].done_at) latest[l.chore_id] = l;
    if (!l.skipped && (!lastDone[l.chore_id] || l.done_at > lastDone[l.chore_id])) lastDone[l.chore_id] = l.done_at;
  });

  var today = todayLocal_();
  var updates = [];
  allRows_('Chores').forEach(function (c) {
    if (c.deleted) return;
    if (wanted && !(c.id in wanted)) return;
    var force = wanted ? wanted[c.id] : false;
    var last = latest[c.id];
    var next;
    if (last) {
      next = choreNextDue_(c.rule, c.rule_value, choreBase_(c.rule, localYmd_(last.done_at), last.due_date), today);
    } else if (c.next_due && !force) {
      next = c.next_due;
    } else {
      next = choreNextDue_(c.rule, c.rule_value, '', today);
    }
    var assignee = choreNextAssignee_(c.assign_mode, c.assignees, c.next_assignee, false);
    var done = lastDone[c.id] || '';
    if (next !== c.next_due || assignee !== c.next_assignee || done !== c.last_done_at) {
      updates.push({ id: c.id, next_due: next, next_assignee: assignee, last_done_at: done });
    }
  });
  if (updates.length) upsertRows_('Chores', updates, 'system');
  return updates.length;
}

/** Menu item and nightly job. */
function recomputeAllChores() {
  var n = withLock_(function () { return recomputeChores_(null); });
  try {
    SpreadsheetApp.getUi().alert('Home Hub', n + ' chore(s) updated.', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    // Running from a trigger: there's no screen to show it on.
  }
}
