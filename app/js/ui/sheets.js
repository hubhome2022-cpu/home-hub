// Bottom sheets: "Who's using?" and quick add.
import { html, useState, useEffect, useRef } from '../vendor.js';
import * as store from '../store.js';
import { useApp, members } from './hooks.js';
import { Icon } from './icons.js';
import { Avatar } from './bits.js';

function Sheet(props) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') props.onClose(); };
    document.addEventListener('keydown', onKey);
    const box = ref.current;
    const first = box && (box.querySelector('input, textarea') || box.querySelector('.stack button, .stack a') || box.querySelector('button'));
    if (first) first.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return html`<div class="scrim" onClick=${(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
    <section class="sheet" role="dialog" aria-modal="true" aria-label=${props.title} ref=${ref}>
      <span class="sheet-grip" aria-hidden="true"></span>
      <div class="sheet-head">
        <h2 class="h2">${props.title}</h2>
        <button class="icon-btn" aria-label="Close" onClick=${props.onClose}><${Icon} name="close" /></button>
      </div>
      ${props.children}
    </section>
  </div>`;
}

export function MemberSheet(props) {
  const app = useApp();
  const people = members();
  return html`<${Sheet} title="Who's using the hub?" onClose=${props.onClose}>
    <div class="stack">
      ${people.map((m) => html`<button class="choice" aria-pressed=${app.member && app.member.id === m.id ? 'true' : 'false'}
          onClick=${() => { app.setMember(m.id); props.onClose(); app.toast('Hi, ' + m.name); }}>
        <${Avatar} member=${m} size="calc(var(--avatar) * 1.2)" />${m.name}
      </button>`)}
      ${people.length === 0 ? html`<p class="muted">No one's set up yet. Add people in the Members tab of the Sheet.</p>` : null}
    </div>
    <div class="stack" style="gap:0.6rem">
      ${app.mode !== 'hub' ? html`<a class="btn btn-block" href="#/devices" onClick=${props.onClose}><${Icon} name="devices" />Devices</a>` : null}
      <a class="btn btn-quiet btn-block" href="#/settings" onClick=${props.onClose}><${Icon} name="gear" />Settings and this device</a>
    </div>
  <//>`;
}

export function QuickAddSheet(props) {
  const [kind, setKind] = useState(null);
  if (kind === 'grocery') return html`<${GroceryForm} onClose=${props.onClose} />`;
  if (kind === 'note') return html`<${NoteForm} onClose=${props.onClose} />`;
  const options = [
    { id: 'grocery', label: 'Grocery item', icon: 'cart' },
    { id: 'note', label: 'Fridge note', icon: 'note' },
    { id: 'event', label: 'Calendar event', icon: 'calendar', later: 3 },
    { id: 'chore', label: 'Chore', icon: 'chores', later: 5 },
    { id: 'workout', label: 'Workout', icon: 'fitness', later: 6 }
  ];
  return html`<${Sheet} title="Add" onClose=${props.onClose}>
    <div class="stack">
      ${options.map((o) => html`<button class="choice" disabled=${!!o.later} onClick=${() => setKind(o.id)}
          style=${o.later ? 'opacity:0.5' : ''}>
        <${Icon} name=${o.icon} />
        <span class="spacer">${o.label}</span>
        ${o.later ? html`<span class="small muted" style="font-weight:600">Phase ${o.later}</span>` : html`<${Icon} name="chevronRight" size="var(--icon-s)" />`}
      </button>`)}
    </div>
  <//>`;
}

function GroceryForm(props) {
  const app = useApp();
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    store.save('Grocery', { name: n, quantity: qty.trim(), checked: false }, app.memberId);
    app.toast(n + ' added to the grocery list');
    setName(''); setQty('');
  };
  return html`<${Sheet} title="Add to the grocery list" onClose=${props.onClose}>
    <form class="stack" style="gap:var(--gap)" onSubmit=${submit}>
      <div class="field"><label for="g-name">Item</label>
        <input id="g-name" class="input" value=${name} onInput=${(e) => setName(e.target.value)} placeholder="Lemons" autocomplete="off" required /></div>
      <div class="field"><label for="g-qty">How much (optional)</label>
        <input id="g-qty" class="input" value=${qty} onInput=${(e) => setQty(e.target.value)} placeholder="3" autocomplete="off" /></div>
      <div class="row">
        <button type="button" class="btn spacer" onClick=${props.onClose}>Done</button>
        <button type="submit" class="btn btn-accent spacer" disabled=${!name.trim()}><${Icon} name="plus" />Add</button>
      </div>
    </form>
  <//>`;
}

function NoteForm(props) {
  const app = useApp();
  const [text, setText] = useState('');
  const [days, setDays] = useState(Number(store.setting('note_default_days', '3')) || 3);
  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    const expires = new Date(Date.now() + days * 864e5).toISOString();
    store.save('Notes', { text: t, author: app.memberId, color: 'yellow', pinned: false, expires_at: expires }, app.memberId);
    app.toast('Note posted');
    props.onClose();
  };
  return html`<${Sheet} title="Leave a fridge note" onClose=${props.onClose}>
    <form class="stack" style="gap:var(--gap)" onSubmit=${submit}>
      <div class="field"><label for="n-text">Note</label>
        <textarea id="n-text" class="input" rows="3" maxlength="200" style="padding:1.6rem 2rem;resize:none"
          value=${text} onInput=${(e) => setText(e.target.value)} placeholder="Scout already had breakfast" required></textarea></div>
      <div class="field"><label>Keep it up for</label>
        <div class="seg" role="radiogroup">
          ${[1, 3, 7].map((d) => html`<button type="button" role="radio" aria-checked=${days === d ? 'true' : 'false'}
            aria-selected=${days === d ? 'true' : 'false'} onClick=${() => setDays(d)}>${d === 1 ? '1 day' : d + ' days'}</button>`)}
        </div></div>
      <button type="submit" class="btn btn-accent btn-block" disabled=${!text.trim()}>Post note</button>
    </form>
  <//>`;
}
