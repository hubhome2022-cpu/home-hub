// Mirrors apps-script/Schema.gs: tab names and id prefixes.
export const PREFIX = {
  Members: 'mem', Rooms: 'rom', Aisles: 'ais', Recipes: 'rcp', MealPlan: 'mpl', Grocery: 'grc',
  GroceryCatalog: 'gct', Projects: 'prj', ProjectTasks: 'ptk', Chores: 'chr', ChoreLog: 'clg',
  Workouts: 'wko', WorkoutSets: 'wst', Exercises: 'exr', Notes: 'nte', Devices: 'dev'
};

export const TABLE_NAMES = Object.keys(PREFIX);

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

export function newId(table) {
  const bytes = new Uint8Array(10);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += ALPHABET.charAt(bytes[i] % ALPHABET.length);
  return PREFIX[table] + '_' + s;
}
