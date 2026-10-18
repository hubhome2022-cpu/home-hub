// Screens for modules that later phases build. They show what's coming and prove
// the data is already on this device.
import { html } from '../vendor.js';
import * as store from '../store.js';
import { Icon } from './icons.js';

const INFO = {
  calendar: { title: 'Calendar', icon: 'calendar', phase: 3, what: 'Your Google calendars, color-coded by person, with day, week, month and agenda views. Add events right from the fridge.', data: [] },
  meals: { title: 'Meals', icon: 'meals', phase: 4, what: 'The recipe box, Cook Mode, the weekly dinner planner and the shared grocery list.', data: [['Recipes', 'recipes'], ['Grocery', 'grocery items'], ['MealPlan', 'planned meals']] },
  chores: { title: 'Chores & projects', icon: 'chores', phase: 5, what: 'The full chore board with points and streaks, and the projects board. Today\'s chores already work on Home.', data: [['Chores', 'chores'], ['Projects', 'projects']] },
  fitness: { title: 'Fitness', icon: 'fitness', phase: 6, what: 'Ten-second workout logging, progress charts and weekly goals for each of you.', data: [['Workouts', 'workouts'], ['Exercises', 'exercises']] },
  devices: { title: 'Devices', icon: 'devices', phase: 7, what: 'Your SmartThings lights, locks and scenes, plus shortcuts to Google Home.', data: [] }
};

export function ComingSoon(props) {
  const info = INFO[props.route];
  if (!info) {
    return html`<div class="empty">
      <h1 class="h2">That page doesn't exist</h1>
      <a class="btn btn-ink" href="#/home">Go to Home</a>
    </div>`;
  }
  const counts = info.data
    .map((d) => [store.rows(d[0]).length, d[1]])
    .filter((c) => c[0] > 0);
  return html`
    <h1 class="h1">${info.title}</h1>
    <div class="empty">
      <span class="empty-icon"><${Icon} name=${info.icon} size="calc(var(--icon) * 1.5)" /></span>
      <h2 class="h2">Arrives in Phase ${info.phase}</h2>
      <p class="muted" style="max-width:34em;line-height:1.45">${info.what}</p>
      ${counts.length
        ? html`<p class="small" style="font-weight:600;color:var(--green)">Already synced to this device: ${counts.map((c) => c[0] + ' ' + c[1]).join(' · ')}</p>`
        : null}
      <a class="btn btn-ink" href="#/home" style="margin-top:1rem">Back to Home</a>
    </div>`;
}
