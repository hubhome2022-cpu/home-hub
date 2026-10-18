// Home: what's happening today. Phase 3 adds weather and the calendar;
// chores, dinner, groceries and the fridge note are live already.
import { html } from '../vendor.js';
import * as store from '../store.js';
import { useApp, useNow, ymd, timeParts, longDate, members } from './hooks.js';
import { Icon } from './icons.js';
import { Avatar } from './bits.js';

export function HomeScreen() {
  const app = useApp();
  const now = useNow();
  const today = ymd(now);
  const t = timeParts(now);
  const hub = app.mode === 'hub';

  return html`
    ${hub
      ? html`<div class="stack" style="gap:0.8rem">
          <div class="row" style="align-items:baseline;gap:1.4rem">
            <span class="num" style="font-family:var(--display);font-size:var(--fs-hero);font-weight:700;letter-spacing:-0.035em;line-height:0.9">${t.time}</span>
            <span style="font-family:var(--display);font-size:5.2rem;font-weight:600;color:var(--muted)">${t.ampm}</span>
          </div>
          <span style="font-size:4rem;font-weight:600">${longDate(now)}</span>
        </div>`
      : html`<div class="stack" style="gap:0.2rem">
          <span class="small muted" style="font-weight:600">${longDate(now)}</span>
          <h1 class="h1">${app.member ? 'Hi, ' + app.member.name : 'Today'}</h1>
        </div>`}
    <${ChoresToday} today=${today} />
    <div class=${hub ? 'grid-2' : 'stack'} style=${hub ? '' : 'gap:var(--gap)'}>
      <${Dinner} today=${today} />
      <div class="stack" style="gap:var(--gap)">
        <${GroceryTile} />
        <${NoteTile} now=${now} />
      </div>
    </div>`;
}

function ChoresToday(props) {
  const app = useApp();
  const today = props.today;
  const pendingDone = new Set(store.pendingOutbox()
    .filter((e) => e.kind === 'call' && e.action === 'completeChore')
    .map((e) => e.payload.chore_id));
  const doneToday = new Set(store.rows('ChoreLog')
    .filter((l) => !l.skipped && l.done_at && ymd(new Date(l.done_at)) === today)
    .map((l) => l.chore_id));

  const items = store.rows('Chores')
    .filter((c) => c.active !== false && ((c.next_due && c.next_due <= today) || doneToday.has(c.id) || pendingDone.has(c.id)))
    .map((c) => ({
      chore: c,
      done: doneToday.has(c.id) || pendingDone.has(c.id),
      late: c.next_due && c.next_due < today && !doneToday.has(c.id) && !pendingDone.has(c.id)
    }))
    .sort((a, b) => (a.done - b.done) || (b.late - a.late) || String(a.chore.title).localeCompare(b.chore.title));

  const people = members();
  const groups = people.map((m) => ({ member: m, items: items.filter((i) => i.chore.next_assignee === m.id) }));
  const anyone = items.filter((i) => !people.some((m) => m.id === i.chore.next_assignee));
  if (anyone.length) groups.push({ member: null, items: anyone });

  const complete = (c) => {
    store.queueCall('completeChore', { chore_id: c.id, done_at: new Date().toISOString() }, app.memberId);
    app.toast('Nice. ' + c.title + ' is done.');
  };

  return html`<section class="card" aria-labelledby="chores-h">
    <div class="card-head">
      <h2 class="h2" id="chores-h">Chores today</h2>
      <a class="small" style="font-weight:700;text-decoration:none" href="#/chores">All chores</a>
    </div>
    ${items.length === 0
      ? html`<div class="row muted" style="padding:1.2rem 0"><${Icon} name="sparkle" /> Nothing due today.</div>`
      : html`<div class=${app.mode === 'hub' && groups.length > 1 ? 'grid-2' : 'stack'} style="gap:var(--gap)">
          ${groups.filter((g) => g.items.length).map((g) => html`<div class="stack">
            <div class="row">
              ${g.member ? html`<${Avatar} member=${g.member} size="calc(var(--avatar) * 0.85)" />` : null}
              <span style="font-weight:700">${g.member ? g.member.name : 'Anyone'}</span>
              <span class="small muted">${countLeft(g.items)}</span>
            </div>
            ${g.items.map((i) => html`<${ChoreRow} item=${i} onDone=${() => complete(i.chore)} />`)}
          </div>`)}
        </div>`}
  </section>`;
}

function countLeft(items) {
  const n = items.filter((i) => !i.done).length;
  return n === 0 ? 'All done' : n + ' left';
}

function ChoreRow(props) {
  const i = props.item;
  const c = i.chore;
  const bg = i.done ? 'var(--green-soft)' : i.late ? 'var(--amber-soft)' : 'var(--ground)';
  const ring = i.done ? 'var(--green-fill)' : i.late ? 'var(--amber-mark)' : 'var(--faint)';
  const meta = i.done ? 'Done' : i.late ? 'Due ' + c.next_due.slice(5).replace('-', '/') + (c.est_min ? ' · ' + c.est_min + ' min' : '') : (c.est_min ? c.est_min + ' min' : c.room || '');
  return html`<button onClick=${i.done ? null : props.onDone} aria-pressed=${i.done ? 'true' : 'false'}
    style=${'display:flex;align-items:center;gap:1.8rem;min-height:var(--tap);padding:1rem 2rem;border-radius:var(--r-tile);border:0;text-align:left;color:var(--ink);background:' + bg}>
    <span style=${'width:calc(var(--tap) * 0.57);height:calc(var(--tap) * 0.57);flex-shrink:0;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;border:0.3rem solid ' + ring + ';background:' + (i.done ? 'var(--green-fill)' : 'var(--surface)')}>
      ${i.done ? html`<${Icon} name="check" size="calc(var(--tap) * 0.34)" stroke="3" />` : null}
    </span>
    <span class="stack" style="gap:0.3rem;min-width:0">
      <span style=${'font-weight:600;line-height:1.2;' + (i.done ? 'text-decoration:line-through;color:var(--muted)' : '')}>${c.title}</span>
      <span class="small" style=${'font-weight:600;color:' + (i.done ? 'var(--green)' : i.late ? 'var(--amber-ink)' : 'var(--muted)')}>${meta}</span>
    </span>
  </button>`;
}

function Dinner(props) {
  const plan = store.rows('MealPlan').find((p) => p.date === props.today && (p.meal || 'dinner') === 'dinner');
  const recipe = plan && plan.recipe_id ? store.row('Recipes', plan.recipe_id) : null;
  const title = recipe ? recipe.title : plan ? plan.label : '';
  return html`<a class="card" href="#/meals" style="text-decoration:none;color:inherit;justify-content:space-between">
    <span class="eyebrow" style="color:var(--green)">Tonight's dinner</span>
    ${title
      ? html`<span class="h3">${title}</span>`
      : html`<span class="h3 muted">Nothing planned yet</span><span class="small muted">Plan it in Meals.</span>`}
    <span class="row small" style="font-weight:700;color:var(--green)">Open Meals <${Icon} name="chevronRight" size="var(--icon-s)" /></span>
  </a>`;
}

function GroceryTile() {
  const left = store.rows('Grocery').filter((g) => !g.checked).length;
  return html`<a class="card" href="#/meals" style="text-decoration:none;color:inherit;flex-direction:row;align-items:center;gap:var(--gap)">
    <span style="color:var(--green)"><${Icon} name="cart" size="calc(var(--icon) * 1.2)" /></span>
    <span class="stack" style="gap:0">
      <span style="font-family:var(--display);font-size:var(--fs-h2);font-weight:700;line-height:1">${left}</span>
      <span class="small muted" style="font-weight:600">${left === 1 ? 'item' : 'items'} on the grocery list</span>
    </span>
  </a>`;
}

function NoteTile(props) {
  const nowIso = props.now.toISOString();
  const notes = store.rows('Notes')
    .filter((n) => n.pinned || !n.expires_at || n.expires_at > nowIso)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const n = notes[0];
  if (!n) return null;
  const author = n.author ? store.row('Members', n.author) : null;
  return html`<div class="card" style="background:var(--note)">
    <span style="font-weight:600;line-height:1.3">${n.text}</span>
    <span class="row small muted" style="font-weight:600">
      ${author ? html`<${Avatar} member=${author} size="calc(var(--avatar) * 0.62)" />` : null}
      ${author ? author.name : 'Note'}${notes.length > 1 ? ' · ' + (notes.length - 1) + ' more' : ''}
    </span>
  </div>`;
}
