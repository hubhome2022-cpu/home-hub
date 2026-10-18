// What the fridge shows when nobody's touched it for a while.
// The content drifts slowly so nothing burns into the screen; any touch wakes it.
import { html } from '../vendor.js';
import * as store from '../store.js';
import { useNow, timeParts, longDate, ymd } from './hooks.js';

export function Ambient(props) {
  const now = useNow();
  const t = timeParts(now);
  const today = ymd(now);
  const plan = store.rows('MealPlan').find((p) => p.date === today && (p.meal || 'dinner') === 'dinner');
  const recipe = plan && plan.recipe_id ? store.row('Recipes', plan.recipe_id) : null;
  const dinner = recipe ? recipe.title : plan ? plan.label : '';
  const choresLeft = store.rows('Chores').filter((c) => c.active !== false && c.next_due && c.next_due <= today).length;
  return html`<button class="ambient" onClick=${props.onWake} aria-label="Wake the screen">
    <div class="ambient-inner">
      <div class="stack" style="gap:1rem">
        <span class="ambient-clock num">${t.time}</span>
        <span class="ambient-sub">${longDate(now)}</span>
      </div>
      ${dinner ? html`<div class="stack" style="gap:0.4rem">
        <span style="font-size:var(--fs-small);font-weight:600;color:#A9AEAB">Tonight</span>
        <span style="font-size:var(--fs-h2);font-weight:600">${dinner}</span>
      </div>` : null}
      ${choresLeft ? html`<span style="font-size:var(--fs-h3);font-weight:600;color:#A9AEAB">${choresLeft} ${choresLeft === 1 ? 'chore' : 'chores'} left today</span>` : null}
    </div>
    <span class="ambient-hint">Touch anywhere to wake</span>
  </button>`;
}

export function Night(props) {
  const now = useNow();
  const t = timeParts(now);
  return html`<button class="night" onClick=${props.onWake} aria-label="Wake the screen">
    <div class="night-inner">
      <span class="night-clock num">${t.time}</span>
      <span class="night-sub">${longDate(now)}</span>
    </div>
  </button>`;
}
