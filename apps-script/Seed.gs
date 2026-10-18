/**
 * Home Hub — starter data and sample data.
 *
 * Starter data is real: the two of you, rooms, store aisles, exercises and a chore
 * library to prune. It's added only where an id is missing, so running it again never
 * overwrites your edits.
 *
 * Sample data is for trying the app before it has real content. Every sample row's id
 * contains "_smp_", and Home Hub › Remove sample data soft-deletes all of them.
 */

var BOTH_ = 'mem_jeremy, mem_allison';

function loadStarterData() {
  var added = withLock_(function () {
    var n = 0;
    n += insertMissing_('Members', [
      { id: 'mem_jeremy', name: 'Jeremy', initial: 'J', color: '#2B5C8A', chip_color: '#DCE7F3', goal_workouts_week: 4, goal_minutes_week: 150, sort_order: 1, active: true },
      { id: 'mem_allison', name: 'Allison', initial: 'A', color: '#A64D72', chip_color: '#F5DFE8', goal_workouts_week: 4, goal_minutes_week: 150, sort_order: 2, active: true }
    ]);
    n += insertMissing_('Rooms', namedRows_('rom', [
      'Kitchen', 'Living room', 'Bedroom', 'Guest room', 'Bathrooms', 'Laundry', 'Basement',
      'Garage', 'Utility', 'Yard', 'Deck', 'Whole house', 'Scout'
    ]));
    n += insertMissing_('Aisles', namedRows_('ais', [
      'Produce', 'Bakery', 'Meat & seafood', 'Deli', 'Dairy & eggs', 'Frozen', 'Pantry',
      'Snacks', 'Drinks', 'Household', 'Pet', 'Other'
    ]));
    n += insertMissing_('Exercises', STARTER_EXERCISES_.map(function (e) {
      return { id: 'exr_' + slug_(e[0]), name: e[0], kind: e[1], measure: e[2], progress_metric: e[3], step: e[4], active: true };
    }));
    var today = todayLocal_();
    var choreRows = STARTER_CHORES_.map(function (c, i) {
      var row = {
        id: 'chr_' + slug_(c[0]), title: c[0], room: c[1], rule: c[2], rule_value: c[3], est_min: c[4],
        assign_mode: c[5] || 'anyone', assignees: BOTH_, notes: c[6] || '', active: true
      };
      // Spread out the long-interval chores so day one isn't a wall of "due today".
      // Fix any of these dates in the Sheet if you know when it was last done.
      var every = parseInt(c[3], 10);
      if (c[2] === 'every_n_days' && every >= 14) {
        row.next_due = addDays_(today, 1 + (i * 3) % Math.floor(every / 2));
      }
      return row;
    });
    var newChores = insertMissing_('Chores', choreRows);
    if (newChores) recomputeChores_(choreRows.map(function (c) { return c.id; }));
    return n + newChores;
  });
  uiAlert_(added + ' starter row(s) added. Everything already there was left alone.\n\n' +
    'Prune the chore list in the Chores tab: untick "active" to pause one, or tick "deleted" to remove it.');
}

/* name, kind, measure, progress_metric, step */
var STARTER_EXERCISES_ = [
  ['Bench press', 'strength', 'weight_reps', 'e1rm', 5],
  ['Incline dumbbell press', 'strength', 'weight_reps', 'e1rm', 5],
  ['Overhead press', 'strength', 'weight_reps', 'e1rm', 5],
  ['Back squat', 'strength', 'weight_reps', 'e1rm', 5],
  ['Front squat', 'strength', 'weight_reps', 'e1rm', 5],
  ['Deadlift', 'strength', 'weight_reps', 'e1rm', 5],
  ['Romanian deadlift', 'strength', 'weight_reps', 'e1rm', 5],
  ['Barbell row', 'strength', 'weight_reps', 'e1rm', 5],
  ['Dumbbell row', 'strength', 'weight_reps', 'e1rm', 5],
  ['Lat pulldown', 'strength', 'weight_reps', 'e1rm', 5],
  ['Leg press', 'strength', 'weight_reps', 'e1rm', 10],
  ['Walking lunges', 'strength', 'weight_reps', 'volume', 5],
  ['Hip thrust', 'strength', 'weight_reps', 'e1rm', 5],
  ['Biceps curl', 'strength', 'weight_reps', 'best_set', 5],
  ['Triceps pushdown', 'strength', 'weight_reps', 'best_set', 5],
  ['Pull-ups', 'strength', 'reps_only', 'best_set', 1],
  ['Push-ups', 'strength', 'reps_only', 'best_set', 1],
  ['Plank', 'strength', 'time_only', 'best_set', 15],
  ['Run', 'cardio', 'distance_time', 'pace', 0.1],
  ['Walk', 'cardio', 'distance_time', 'distance', 0.1],
  ['Bike', 'cardio', 'distance_time', 'distance', 0.5],
  ['Rowing machine', 'cardio', 'distance_time', 'pace', 0.1],
  ['Elliptical', 'cardio', 'time_only', 'volume', 5],
  ['Yoga', 'mobility', 'time_only', 'volume', 5],
  ['Stretching', 'mobility', 'time_only', 'volume', 5]
];

/* title, room, rule, rule_value, est_min, assign_mode, notes */
var STARTER_CHORES_ = [
  ['Wipe kitchen counters', 'Kitchen', 'daily', '', 10],
  ['Run and empty the dishwasher', 'Kitchen', 'daily', '', 10],
  ['Clean the microwave', 'Kitchen', 'weekly', 'SA', 10],
  ['Mop the kitchen floor', 'Kitchen', 'weekly', 'SA', 20],
  ['Wipe appliance fronts', 'Kitchen', 'weekly', 'WE', 10],
  ['Clean out the fridge', 'Kitchen', 'every_n_days', '14', 20, 'rotate'],
  ['Clean the oven', 'Kitchen', 'every_n_days', '90', 45],
  ['Clean bathroom sinks and counters', 'Bathrooms', 'every_n_days', '4', 15],
  ['Clean toilets', 'Bathrooms', 'weekly', 'SA', 15],
  ['Scrub shower and tub', 'Bathrooms', 'every_n_days', '14', 25],
  ['Swap bath towels', 'Bathrooms', 'weekly', 'SU', 5],
  ['Vacuum the main floor', 'Living room', 'weekly', 'WE, SA', 25],
  ['Vacuum the bedrooms', 'Bedroom', 'weekly', 'TH', 20],
  ['Dust the living room', 'Living room', 'weekly', 'SA', 15],
  ['Change bed sheets', 'Bedroom', 'every_n_days', '14', 20, 'rotate'],
  ['Trash and recycling to the curb', 'Garage', 'weekly', 'TU', 5, 'anyone', 'Change rule_value to your pickup day(s).'],
  ['Replace furnace filter', 'Utility', 'every_n_days', '90', 10, 'anyone', 'Write the filter size here, e.g. 16x25x1.'],
  ['Test smoke and CO detectors', 'Whole house', 'monthly', '1', 10],
  ['Refill water softener salt', 'Utility', 'every_n_days', '45', 10, 'anyone', 'Untick active if you have no softener.'],
  ['Book the furnace tune-up', 'Utility', 'seasonal', '09-01..10-15', 15],
  ['Clean the dryer vent', 'Laundry', 'seasonal', '03-01..04-30', 30],
  ['Clean the gutters', 'Yard', 'seasonal', '10-25..11-25', 60],
  ['Shut off and drain outdoor hoses', 'Yard', 'seasonal', '10-15..11-15', 15, 'anyone', 'Before the first hard freeze.'],
  ['Snowblower tune-up and fresh gas', 'Garage', 'seasonal', '10-15..11-30', 30],
  ['Winterize the lawn mower', 'Garage', 'seasonal', '10-20..11-30', 30],
  ['Turn the outdoor faucets back on', 'Yard', 'seasonal', '04-15..05-15', 10],
  ['Lawn mower spring tune-up', 'Garage', 'seasonal', '04-01..04-30', 30],
  ['Feed Scout breakfast', 'Scout', 'daily', '', 5],
  ['Feed Scout dinner', 'Scout', 'daily', '', 5],
  ['Walk Scout', 'Scout', 'daily', '', 30],
  ['Brush Scout', 'Scout', 'weekly', 'SU', 15],
  ["Trim Scout's nails", 'Scout', 'every_n_days', '21', 15],
  ["Scout's heartworm prevention", 'Scout', 'monthly', '1', 2],
  ["Scout's flea and tick prevention", 'Scout', 'monthly', '1', 2],
  ["Wash Scout's bedding", 'Scout', 'every_n_days', '14', 10],
  ["Scout's senior checkup at the vet", 'Scout', 'every_n_days', '182', 60, 'anyone', 'Senior dogs usually see the vet about every 6 months. Adjust to what your vet recommends.']
];

/* ---------- Sample data ---------- */

function loadSampleData() {
  var added = withLock_(function () {
    var today = todayLocal_();
    var n = 0;
    n += insertMissing_('Recipes', [
      { id: 'rcp_smp_aglio', title: 'Spaghetti Aglio e Olio', tags: 'Pasta, Vegetarian, Weeknight', servings: 4, prep_min: 5, cook_min: 20,
        ingredients: '1 lb spaghetti\n1/2 cup olive oil\n6 cloves garlic, thinly sliced\n1/2 tsp red pepper flakes\n1/4 cup chopped parsley\nKosher salt\nParmesan, to serve',
        steps: 'Bring a large pot of well-salted water to a boil.\nAdd the spaghetti and cook until just shy of al dente, about 9 minutes.\nWarm the olive oil and garlic in a large skillet over medium-low heat until the garlic is pale golden, about 5 minutes.\nStir in the red pepper flakes, cook 30 seconds, then take the pan off the heat.\nReserve 1 cup of pasta water. Drain, add the spaghetti to the skillet with 1/2 cup of the water, and toss until glossy, about 2 minutes.\nStir in the parsley, season with salt, and serve with Parmesan.',
        favorite: true, rating: 5, import_status: 'manual', notes: 'Sample recipe.' },
      { id: 'rcp_smp_lemonchx', title: 'Lemon Chicken with Lemon Butter Sauce', tags: 'Chicken, Weeknight', servings: 4, prep_min: 10, cook_min: 30,
        ingredients: '1.5 lb chicken breasts\n1 tsp kosher salt\n1/2 tsp black pepper\n2 tbsp olive oil\n3 tbsp butter\n3 cloves garlic, minced\n1/2 cup chicken broth\n2 lemons, juiced\n1 tbsp chopped parsley',
        steps: 'Season the chicken with salt and pepper.\nSear the chicken in the oil over medium-high heat until golden and cooked through, about 6 minutes per side. Set aside.\nLower the heat, melt the butter and cook the garlic for 1 minute.\nAdd the broth and lemon juice and simmer until slightly thickened, about 4 minutes.\nReturn the chicken, spoon the sauce over and sprinkle with parsley.',
        favorite: true, rating: 4, import_status: 'manual', notes: 'Sample recipe.' },
      { id: 'rcp_smp_cobb', title: 'Greek Cobb Salad', tags: 'Salad, No cook', servings: 4, prep_min: 20, cook_min: 0,
        ingredients: '2 heads romaine, chopped\n4 hard-boiled eggs, quartered\n1 cup cherry tomatoes, halved\n1 cucumber, diced\n1/2 cup kalamata olives\n4 oz feta, crumbled\n1/3 cup Greek vinaigrette',
        steps: 'Arrange the romaine on a large platter.\nLay the eggs, tomatoes, cucumber, olives and feta over it in rows.\nDrizzle with the vinaigrette just before serving.',
        rating: 4, import_status: 'manual', notes: 'Sample recipe.' }
    ]);
    n += insertMissing_('MealPlan', [
      { id: 'mpl_smp_1', date: today, meal: 'dinner', recipe_id: 'rcp_smp_lemonchx', servings: 4 },
      { id: 'mpl_smp_2', date: addDays_(today, 1), meal: 'dinner', recipe_id: 'rcp_smp_aglio', servings: 4 },
      { id: 'mpl_smp_3', date: addDays_(today, 3), meal: 'dinner', recipe_id: 'rcp_smp_cobb', servings: 4 },
      { id: 'mpl_smp_4', date: addDays_(today, 5), meal: 'dinner', label: 'Leftovers' }
    ]);
    n += insertMissing_('Grocery', [
      { id: 'grc_smp_1', name: 'Lemons', quantity: '2', aisle_id: 'ais_produce', recipe_ids: 'rcp_smp_lemonchx', checked: false },
      { id: 'grc_smp_2', name: 'Parsley', quantity: '1 bunch', aisle_id: 'ais_produce', recipe_ids: 'rcp_smp_aglio, rcp_smp_lemonchx', checked: false },
      { id: 'grc_smp_3', name: 'Romaine', quantity: '2 heads', aisle_id: 'ais_produce', recipe_ids: 'rcp_smp_cobb', checked: false },
      { id: 'grc_smp_4', name: 'Chicken breasts', quantity: '1.5 lb', aisle_id: 'ais_meat_seafood', recipe_ids: 'rcp_smp_lemonchx', checked: true },
      { id: 'grc_smp_5', name: 'Feta', quantity: '4 oz', aisle_id: 'ais_dairy_eggs', recipe_ids: 'rcp_smp_cobb', checked: false },
      { id: 'grc_smp_6', name: "Scout's kibble", quantity: '1 bag', aisle_id: 'ais_pet', checked: false }
    ]);
    n += insertMissing_('Projects', [
      { id: 'prj_smp_shelves', title: 'Basement storage shelves', status: 'in_progress', room: 'Basement', owner: 'mem_jeremy',
        due_date: addDays_(today, 15), budget: 250, spent: 180, sort_order: 1, notes: 'Sample project.' },
      { id: 'prj_smp_ramp', title: 'Ramp for Scout to the deck', status: 'planned', room: 'Deck', owner: 'mem_jeremy',
        due_date: addDays_(today, 29), budget: 120, spent: 0, sort_order: 2, notes: 'Sample project.' }
    ]);
    n += insertMissing_('ProjectTasks', [
      { id: 'ptk_smp_1', project_id: 'prj_smp_shelves', title: 'Measure the wall', done: true, sort_order: 1 },
      { id: 'ptk_smp_2', project_id: 'prj_smp_shelves', title: 'Buy brackets and boards', done: true, sort_order: 2 },
      { id: 'ptk_smp_3', project_id: 'prj_smp_shelves', title: 'Mount the uprights', done: false, sort_order: 3 },
      { id: 'ptk_smp_4', project_id: 'prj_smp_ramp', title: 'Measure the step height', done: false, sort_order: 1 },
      { id: 'ptk_smp_5', project_id: 'prj_smp_ramp', title: 'Pick a non-slip surface', done: false, sort_order: 2 }
    ]);
    n += insertMissing_('Workouts', [
      { id: 'wko_smp_1', member_id: 'mem_jeremy', date: addDays_(today, -1), type: 'strength', title: 'Upper body', duration_min: 33, effort: 7 },
      { id: 'wko_smp_2', member_id: 'mem_allison', date: addDays_(today, -2), type: 'cardio', title: 'Run', duration_min: 29, effort: 6 }
    ]);
    n += insertMissing_('WorkoutSets', [
      { id: 'wst_smp_1', workout_id: 'wko_smp_1', exercise_id: 'exr_bench_press', set_no: 1, reps: 5, weight: 175 },
      { id: 'wst_smp_2', workout_id: 'wko_smp_1', exercise_id: 'exr_bench_press', set_no: 2, reps: 5, weight: 175 },
      { id: 'wst_smp_3', workout_id: 'wko_smp_1', exercise_id: 'exr_barbell_row', set_no: 1, reps: 8, weight: 135 },
      { id: 'wst_smp_4', workout_id: 'wko_smp_2', exercise_id: 'exr_run', set_no: 1, distance: 3.1, duration_sec: 1725 }
    ]);
    n += insertMissing_('Notes', [
      { id: 'nte_smp_1', text: "Scout's new meds are on the top pantry shelf. One pill with dinner.", author: 'mem_allison',
        color: 'yellow', pinned: false, expires_at: new Date(Date.now() + 3 * 864e5).toISOString() }
    ]);
    return n;
  });
  uiAlert_(added + ' sample row(s) added. Remove them any time with Home Hub › Remove sample data.');
}

function removeSampleData() {
  var removed = withLock_(function () {
    var n = 0;
    TABLE_ORDER.forEach(function (name) {
      var rows = allRows_(name).filter(function (r) { return !r.deleted && r.id.indexOf('_smp_') !== -1; });
      if (rows.length) {
        upsertRows_(name, rows.map(function (r) { return { id: r.id, deleted: true }; }), 'system');
        n += rows.length;
      }
    });
    return n;
  });
  uiAlert_(removed + ' sample row(s) removed. They stay in the Sheet marked deleted, so every device drops them on its next sync.');
}

/* ---------- Helpers ---------- */

/** Adds only rows whose id isn't in the tab yet. Returns how many were added. Caller holds the lock. */
function insertMissing_(name, rows) {
  var have = readTable_(name).index;
  var fresh = rows.filter(function (r) { return have[r.id] === undefined; });
  if (fresh.length) upsertRows_(name, fresh, 'system');
  return fresh.length;
}

function namedRows_(prefix, names) {
  return names.map(function (n, i) { return { id: prefix + '_' + slug_(n), name: n, sort_order: i + 1 }; });
}

function slug_(s) {
  return String(s).toLowerCase().replace(/&/g, ' ').replace(/'s\b/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 40);
}

function uiAlert_(msg) {
  try {
    SpreadsheetApp.getUi().alert('Home Hub', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) { /* run from the editor or a trigger */ }
}
