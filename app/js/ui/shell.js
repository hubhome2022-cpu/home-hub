import { html, useState, useEffect, useMemo, useCallback } from '../vendor.js';
import * as store from '../store.js';
import { syncNow } from '../sync.js';
import { LS, idleMs, markActive, isNightTime, themeFor, applyTheme } from '../device.js';
import { AppCtx, useApp, useData, useSyncStatus, useNow, useRoute, timeParts, members } from './hooks.js';
import { Icon } from './icons.js';
import { Avatar } from './bits.js';
import { HomeScreen } from './home.js';
import { SettingsScreen } from './settings.js';
import { ComingSoon } from './placeholder.js';
import { MemberSheet, QuickAddSheet } from './sheets.js';
import { Ambient, Night } from './ambient.js';

const NAV = [
  { id: 'home', label: 'Home', phoneLabel: 'Today', icon: 'home' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'meals', label: 'Meals', icon: 'meals' },
  { id: 'add' },
  { id: 'chores', label: 'Chores', icon: 'chores' },
  { id: 'fitness', label: 'Fitness', icon: 'fitness' },
  { id: 'devices', label: 'Devices', icon: 'devices', hubOnly: true }
];

export function App(props) {
  useData();
  const route = useRoute();
  const mode = props.mode;
  const [memberId, setMemberIdState] = useState(() => LS.get('hh.member') || '');
  const [sheet, setSheet] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [overlay, setOverlay] = useState(null); // null | 'ambient' | 'night'

  const people = members();
  const member = people.find((m) => m.id === memberId) || people[0] || null;

  const setMember = useCallback((id) => { LS.set('hh.member', id); setMemberIdState(id); }, []);
  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toast.t);
    toast.t = setTimeout(() => setToastMsg(''), 3200);
  }, []);

  const ctx = useMemo(() => ({
    mode: mode, demo: props.demo, api: props.api, member: member, memberId: member ? member.id : 'system',
    setMember: setMember, toast: toast, openSheet: setSheet, onSignOut: props.onSignOut, updateReady: props.updateReady
  }), [mode, member, props.updateReady]);

  // Theme follows the night window; re-checked every minute.
  const now = useNow();
  useEffect(() => { applyTheme(themeFor(store.setting)); }, [now]);

  // Hub: after a few idle minutes show the ambient screen (or the night clock).
  useEffect(() => {
    if (mode !== 'hub') return undefined;
    const check = () => {
      const after = Math.max(1, Number(store.setting('ambient_after_min', '5')) || 5) * 60000;
      if (sheet || idleMs() < after) return;
      const night = isNightTime(store.setting('night_start', '21:00'), store.setting('night_end', '05:00'));
      setOverlay(night ? 'night' : 'ambient');
    };
    const t = setInterval(check, 15000);
    return () => clearInterval(t);
  }, [mode, sheet]);

  const wake = () => {
    markActive();
    setOverlay(null);
    if (location.hash !== '#/home') location.hash = '#/home';
  };

  let screen;
  if (route === 'home') screen = html`<${HomeScreen} />`;
  else if (route === 'settings') screen = html`<${SettingsScreen} />`;
  else screen = html`<${ComingSoon} route=${route} />`;

  return html`<${AppCtx.Provider} value=${ctx}>
    <div class="app">
      <${StatusBar} route=${route} />
      <main class="main" id="main" key=${route}>
        <div class="screen-enter stack" style="gap:var(--gap)">${screen}</div>
      </main>
      ${mode === 'hub' ? html`<${HubDock} route=${route} />` : html`<${PhoneTabs} route=${route} />`}
    </div>
    ${sheet === 'member' ? html`<${MemberSheet} onClose=${() => setSheet(null)} />` : null}
    ${sheet === 'add' ? html`<${QuickAddSheet} onClose=${() => setSheet(null)} />` : null}
    ${toastMsg ? html`<div class="toast" role="status">${toastMsg}</div>` : null}
    ${overlay === 'ambient' ? html`<${Ambient} onWake=${wake} />` : null}
    ${overlay === 'night' ? html`<${Night} onWake=${wake} />` : null}
  <//>`;
}

function StatusBar(props) {
  const app = useApp();
  const now = useNow();
  const sync = useSyncStatus();
  const t = timeParts(now);
  const m = app.member;
  const isHome = props.route === 'home';
  const left = app.mode === 'hub' && isHome ? greetingLine(now) : t.time + ' ' + t.ampm;
  return html`<header class="status">
    <span class="status-left">${left}${app.demo ? ' · Demo' : ''}</span>
    <div class="status-right">
      <${SyncPill} sync=${sync} />
      <button class="who" onClick=${() => app.openSheet('member')}
        aria-label=${m ? 'Switch person, now ' + m.name : 'Choose who is using the hub'}>
        <${Avatar} member=${m} />
        ${app.mode === 'hub' ? html`<span>${m ? m.name : 'Who?'}</span><${Icon} name="chevronDown" size="var(--icon-s)" />` : null}
      </button>
    </div>
  </header>`;
}

function greetingLine(d) {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function SyncPill(props) {
  const s = props.sync;
  let dot = 'dot-ok';
  let label = 'Synced';
  if (s.state === 'syncing') { dot = 'dot-busy'; label = 'Syncing'; }
  else if (s.state === 'offline') { dot = 'dot-off'; label = s.pending ? 'Offline · ' + s.pending + ' waiting' : 'Offline'; }
  else if (s.state === 'error' || s.state === 'needs_key') { dot = 'dot-bad'; label = 'Sync problem'; }
  else if (s.pending) { dot = 'dot-busy'; label = s.pending + ' waiting'; }
  return html`<button class="pill" onClick=${() => { location.hash = '#/settings'; syncNow(); }}
    aria-label=${'Sync status: ' + label + '. Open settings.'}>
    <span class=${'dot ' + dot}></span>${label}
  </button>`;
}


function HubDock(props) {
  const app = useApp();
  return html`<nav class="dock" aria-label="Main">
    ${NAV.map((n) => n.id === 'add'
      ? html`<button class="dock-item dock-add" onClick=${() => app.openSheet('add')}>
          <span class="dock-icon"><${Icon} name="plus" size="4.6rem" stroke="2.6" /></span>Add
        </button>`
      : html`<a class="dock-item" href=${'#/' + n.id} aria-current=${props.route === n.id ? 'page' : null}>
          <span class="dock-icon"><${Icon} name=${n.icon} /></span>${n.label}
        </a>`)}
  </nav>`;
}

function PhoneTabs(props) {
  const app = useApp();
  const tabs = NAV.filter((n) => n.id !== 'add' && !n.hubOnly);
  return html`
    <button class="fab" aria-label="Quick add" onClick=${() => app.openSheet('add')}><${Icon} name="plus" size="2.8rem" stroke="2.6" /></button>
    <nav class="dock" aria-label="Main">
      ${tabs.map((n) => html`<a class="dock-item" href=${'#/' + n.id} aria-current=${props.route === n.id ? 'page' : null}>
        <span class="dock-icon"><${Icon} name=${n.icon} size="2rem" /></span>${n.phoneLabel || n.label}
      </a>`)}
    </nav>`;
}
