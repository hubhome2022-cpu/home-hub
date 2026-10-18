// Settings and this device: sync health, pairing another device, layout and theme,
// and a browser check for the fridge.
import { html, useState, useEffect } from '../vendor.js';
import { syncNow } from '../sync.js';
import { forcedMode, setForcedMode, themeChoice, setThemeChoice, applyTheme, themeFor, capabilities } from '../device.js';
import * as store from '../store.js';
import { APP_VERSION } from '../../config.js';
import { useApp, useSyncStatus, relativeTime } from './hooks.js';
import { Icon } from './icons.js';

export function SettingsScreen() {
  const app = useApp();
  return html`
    <h1 class="h1">Settings</h1>
    <${SyncCard} />
    <${PairCard} />
    <${DeviceCard} />
    <${BrowserCard} />
    <section class="card">
      <h2 class="h3">Remove this device</h2>
      <p class="small muted">Forgets the household key and the copy of your data on this device. The Sheet keeps everything.</p>
      <button class="btn" style="align-self:flex-start" onClick=${() => {
        if (confirm('Remove Home Hub from this device? You can pair it again any time.')) app.onSignOut();
      }}>Remove this device</button>
    </section>
    <p class="small muted" style="text-align:center">Home Hub ${APP_VERSION}${app.demo ? ' · demo data' : ''}</p>`;
}

function SyncCard() {
  const s = useSyncStatus();
  const [busy, setBusy] = useState(false);
  const label = {
    idle: s.pending ? 'Waiting to send' : 'Up to date',
    syncing: 'Syncing now',
    offline: 'Offline',
    error: 'Sync problem',
    needs_key: 'Needs the household key'
  }[s.state] || s.state;
  return html`<section class="card" aria-labelledby="sync-h">
    <div class="card-head">
      <h2 class="h3" id="sync-h">Sync</h2>
      <button class="btn" disabled=${busy} onClick=${async () => { setBusy(true); await syncNow(); setBusy(false); }}>
        <${Icon} name="refresh" size="var(--icon-s)" />Sync now
      </button>
    </div>
    <div class="kv"><span class="muted">Status</span><span>${label}</span></div>
    ${s.message ? html`<div class="banner">${s.message}</div>` : null}
    <div class="kv"><span class="muted">Last synced</span><span>${relativeTime(s.lastSync)}</span></div>
    <div class="kv"><span class="muted">Changes waiting to send</span><span>${s.pending}</span></div>
    ${store.isPersistent() ? null : html`<div class="banner">This browser isn't saving data between visits (private mode?). Everything still syncs.</div>`}
    ${s.problems.length ? html`<div class="stack">
      <span class="eyebrow">Changes the Sheet refused</span>
      ${s.problems.map((p) => html`<div class="small"><strong>${p.code}</strong> · ${p.message}</div>`)}
    </div>` : null}
  </section>`;
}

function PairCard() {
  const app = useApp();
  const [state, setState] = useState({ code: '', until: 0, error: '', busy: false });
  const [, tick] = useState(0);
  useEffect(() => {
    if (!state.code) return undefined;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [state.code]);
  const left = Math.max(0, Math.round((state.until - Date.now()) / 1000));
  const make = async () => {
    setState({ code: '', until: 0, error: '', busy: true });
    try {
      const res = await app.api('pair.create', {}, app.memberId);
      setState({ code: res.code, until: Date.now() + res.expiresInSec * 1000, error: '', busy: false });
    } catch (e) {
      setState({ code: '', until: 0, busy: false,
        error: e.code === 'offline' ? 'This device is offline. Pairing needs a connection.' :
          e.code === 'unknown_action' ? 'The Sheet\'s script needs updating first (Api.gs, then deploy a new version).' : (e.message || 'Something went wrong') });
    }
  };
  return html`<section class="card" aria-labelledby="pair-h">
    <h2 class="h3" id="pair-h">Add another device</h2>
    <p class="small muted">On the new phone or the fridge, open Home Hub and choose <strong>Pairing code</strong>. No need to type the household key.</p>
    ${state.code && left > 0
      ? html`<div class="stack" style="align-items:center;padding:1.6rem 0">
          <span class="num" style="font-family:var(--display);font-size:calc(var(--fs-h1) * 1.2);font-weight:700;letter-spacing:0.2em">${state.code}</span>
          <span class="small muted">Works once, for ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} more</span>
        </div>`
      : html`<button class="btn btn-ink" style="align-self:flex-start" disabled=${state.busy} onClick=${make}>
          <${Icon} name="link" size="var(--icon-s)" />${state.busy ? 'Getting a code…' : 'Show a pairing code'}
        </button>`}
    ${state.error ? html`<div class="banner">${state.error}</div>` : null}
  </section>`;
}

function DeviceCard() {
  const app = useApp();
  const [theme, setTheme] = useState(themeChoice());
  const mode = forcedMode();
  const pickMode = (m) => { setForcedMode(m); location.reload(); };
  const pickTheme = (t) => { setThemeChoice(t); setTheme(t); applyTheme(themeFor(store.setting)); };
  return html`<section class="card" aria-labelledby="dev-h">
    <h2 class="h3" id="dev-h">This device</h2>
    <div class="field"><label>Layout</label>
      <div class="seg" role="radiogroup" aria-label="Layout">
        ${[['auto', 'Automatic'], ['hub', 'Fridge'], ['phone', 'Phone']].map((o) => html`<button role="radio"
          aria-checked=${mode === o[0] ? 'true' : 'false'} aria-selected=${mode === o[0] ? 'true' : 'false'} onClick=${() => pickMode(o[0])}>${o[1]}</button>`)}
      </div>
      <span class="small muted">Now showing the ${app.mode === 'hub' ? 'fridge' : 'phone'} layout.</span>
    </div>
    <div class="field"><label>Light or dark</label>
      <div class="seg" role="radiogroup" aria-label="Light or dark">
        ${[['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']].map((o) => html`<button role="radio"
          aria-checked=${theme === o[0] ? 'true' : 'false'} aria-selected=${theme === o[0] ? 'true' : 'false'} onClick=${() => pickTheme(o[0])}>${o[1]}</button>`)}
      </div>
      <span class="small muted">Automatic goes dark in the evening and at night.</span>
    </div>
  </section>`;
}

function BrowserCard() {
  const [open, setOpen] = useState(false);
  return html`<section class="card" aria-labelledby="br-h">
    <div class="card-head">
      <h2 class="h3" id="br-h">Browser check</h2>
      <button class="btn btn-quiet" aria-expanded=${open ? 'true' : 'false'} onClick=${() => setOpen(!open)}>${open ? 'Hide' : 'Show'}</button>
    </div>
    ${open ? html`<div class="stack small">
      ${capabilities().map((c) => html`<div class="kv"><span class="muted">${c[0]}</span><span>${c[1]}</span></div>`)}
    </div>` : html`<p class="small muted">What this browser supports. Useful on the fridge.</p>`}
  </section>`;
}
