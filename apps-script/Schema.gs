/**
 * Home Hub — table definitions.
 *
 * Every table (except Settings) starts with the five STANDARD_COLUMNS.
 * Column types:
 *   id     text id of a row in some table (member ids, recipe ids…)
 *   ts     ISO 8601 UTC timestamp text, e.g. 2026-10-17T12:42:00.000Z
 *   d      date text, YYYY-MM-DD
 *   t      free text
 *   list   comma-separated list (text)
 *   lines  newline-separated list (text)
 *   n      number
 *   b      TRUE/FALSE (checkbox)
 *   ['a','b']  dropdown with fixed values
 *   {range: 'Rooms'}  dropdown fed by another tab's `name` column
 */

var API_VERSION = '1.1.0';

var STANDARD_COLUMNS = [
  ['id', 'id'],
  ['created_at', 'ts'],
  ['updated_at', 'ts'],
  ['updated_by', 'id'],
  ['deleted', 'b']
];

var TABLES = {
  Members: { prefix: 'mem', cols: [
    ['name', 't'], ['initial', 't'], ['color', 't'], ['chip_color', 't'], ['avatar_url', 't'],
    ['calendar_id', 't'], ['goal_workouts_week', 'n'], ['goal_minutes_week', 'n'],
    ['sort_order', 'n'], ['active', 'b']
  ] },
  Recipes: { prefix: 'rcp', cols: [
    ['title', 't'], ['source_url', 't'], ['image_url', 't'], ['tags', 'list'], ['servings', 'n'],
    ['prep_min', 'n'], ['cook_min', 'n'], ['ingredients', 'lines'], ['steps', 'lines'], ['notes', 't'],
    ['favorite', 'b'], ['rating', 'n'], ['times_cooked', 'n'], ['last_cooked', 'd'],
    ['import_status', ['ok', 'needs_review', 'manual']]
  ] },
  MealPlan: { prefix: 'mpl', cols: [
    ['date', 'd'], ['meal', ['breakfast', 'lunch', 'dinner']], ['recipe_id', 'id'], ['label', 't'],
    ['servings', 'n'], ['cook', 'id'], ['notes', 't']
  ] },
  Grocery: { prefix: 'grc', cols: [
    ['name', 't'], ['quantity', 't'], ['aisle_id', 'id'], ['recipe_ids', 'list'],
    ['checked', 'b'], ['checked_at', 'ts'], ['checked_by', 'id']
  ] },
  Aisles: { prefix: 'ais', cols: [
    ['name', 't'], ['sort_order', 'n']
  ] },
  GroceryCatalog: { prefix: 'gct', cols: [
    ['name', 't'], ['aisle_id', 'id'], ['usual_quantity', 't'], ['times_bought', 'n']
  ] },
  Projects: { prefix: 'prj', cols: [
    ['title', 't'], ['status', ['idea', 'planned', 'in_progress', 'done']], ['room', { range: 'Rooms' }],
    ['owner', 'id'], ['due_date', 'd'], ['budget', 'n'], ['spent', 'n'], ['cover_url', 't'],
    ['photo_urls', 'lines'], ['notes', 't'], ['completed_at', 'ts'], ['sort_order', 'n']
  ] },
  ProjectTasks: { prefix: 'ptk', cols: [
    ['project_id', 'id'], ['title', 't'], ['done', 'b'], ['done_at', 'ts'], ['done_by', 'id'],
    ['assignee', 'id'], ['due_date', 'd'], ['sort_order', 'n']
  ] },
  Chores: { prefix: 'chr', cols: [
    ['title', 't'], ['room', { range: 'Rooms' }],
    ['rule', ['daily', 'weekly', 'every_n_days', 'monthly', 'seasonal', 'once']], ['rule_value', 't'],
    ['assign_mode', ['fixed', 'rotate', 'anyone']], ['assignees', 'list'], ['next_assignee', 'id'],
    ['est_min', 'n'], ['points', 'n'], ['last_done_at', 'ts'], ['next_due', 'd'], ['active', 'b'], ['notes', 't']
  ] },
  ChoreLog: { prefix: 'clg', cols: [
    ['chore_id', 'id'], ['done_at', 'ts'], ['done_by', 'id'], ['points', 'n'], ['skipped', 'b'], ['note', 't'],
    ['due_date', 'd']
  ] },
  Rooms: { prefix: 'rom', cols: [
    ['name', 't'], ['sort_order', 'n']
  ] },
  Workouts: { prefix: 'wko', cols: [
    ['member_id', 'id'], ['date', 'd'], ['type', ['strength', 'cardio', 'freeform']], ['title', 't'],
    ['duration_min', 'n'], ['effort', 'n'], ['notes', 't']
  ] },
  WorkoutSets: { prefix: 'wst', cols: [
    ['workout_id', 'id'], ['exercise_id', 'id'], ['set_no', 'n'], ['reps', 'n'], ['weight', 'n'],
    ['distance', 'n'], ['duration_sec', 'n'], ['notes', 't']
  ] },
  Exercises: { prefix: 'exr', cols: [
    ['name', 't'], ['kind', ['strength', 'cardio', 'mobility']],
    ['measure', ['weight_reps', 'reps_only', 'distance_time', 'time_only']],
    ['progress_metric', ['best_set', 'e1rm', 'pace', 'distance', 'volume']], ['step', 'n'], ['active', 'b']
  ] },
  Notes: { prefix: 'nte', cols: [
    ['text', 't'], ['author', 'id'], ['color', ['yellow', 'blue', 'pink', 'green']], ['pinned', 'b'], ['expires_at', 'ts']
  ] },
  Devices: { prefix: 'dev', cols: [
    ['source', ['smartthings', 'google_shortcut']], ['external_id', 't'], ['display_name', 't'], ['room', 't'],
    ['icon', ['light', 'lock', 'thermostat', 'camera', 'tv', 'fridge', 'washer', 'plug', 'other']],
    ['url', 't'], ['hidden', 'b'], ['sort_order', 'n']
  ] }
};

/** Tab order in the spreadsheet. Lookup tabs come before the tabs whose dropdowns read them. */
var TABLE_ORDER = [
  'Members', 'Rooms', 'Aisles', 'Recipes', 'MealPlan', 'Grocery', 'GroceryCatalog',
  'Projects', 'ProjectTasks', 'Chores', 'ChoreLog', 'Workouts', 'WorkoutSets', 'Exercises',
  'Notes', 'Devices'
];

var SETTINGS_TAB = 'Settings';
var SETTINGS_COLUMNS = ['key', 'value', 'updated_at'];

var SETTINGS_DEFAULTS = [
  ['household_name', 'Our Home'],
  ['timezone', 'America/Chicago'],
  ['latitude', ''],
  ['longitude', ''],
  ['units_weight', 'lb'],
  ['units_distance', 'mi'],
  ['week_starts_on', 'SUN'],
  ['meals_enabled', 'dinner'],
  ['family_calendar_id', ''],
  ['extra_calendar_ids', ''],
  ['night_start', '21:00'],
  ['night_end', '05:00'],
  ['ambient_after_min', '5'],
  ['nightly_reload', '03:00'],
  ['slideshow_source', ''],
  ['points_per_minute', '0.2'],
  ['note_default_days', '3']
];

/** Full column list (standard + table-specific) as [name, type] pairs. */
function tableColumns_(name) {
  var def = TABLES[name];
  if (!def) throw apiError_('unknown_table', 'There is no table named "' + name + '".');
  return STANDARD_COLUMNS.concat(def.cols);
}

function columnNames_(name) {
  return tableColumns_(name).map(function (c) { return c[0]; });
}

function columnTypes_(name) {
  var out = {};
  tableColumns_(name).forEach(function (c) { out[c[0]] = c[1]; });
  return out;
}
