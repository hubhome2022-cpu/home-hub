// Starts Home Hub: picks the layout, connects to the household (or shows setup),
// loads this device's saved data, and starts background sync.
import { html, render } from './vendor.js';
import { API_URL } from '../config.js';
import { createApi } from './api.js';
import { DemoServer } from './demo.js';
import * as store from './store.js';
import { startSync } from './sync.js';
import {
  LS, detectMode, applyMode, applyTheme, themeFor, keepAwake, scheduleNightlyReload, registerServiceWorker, idleMs
} from './device.js';
import { App } from './ui/shell.js';
import { Setup } from './ui/setup.js';

const root = document.getElementById('app');
const params = new URLSearchParams(location.search);
if (params.has('demo')) LS.set('hh.demo', '1');
const demo = LS.get('hh.demo') === '1';
const mode = detectMode();
applyMode(mode);
applyTheme(themeFor(() => ''));

let updateReady = false;

function apiUrl() { return LS.get('hh.url') || API_URL; }

async function boot() {
  registerServiceWorker(onUpdate);
  if (demo) {
    const server = new DemoServer();
    window.homeHubDemo = server; // for testing: homeHubDemo.offline = true
    return startApp(createApi({ demo: server }), 'homehub-demo', server);
  }
  const key = LS.get('hh.key');
  if (!key) return showSetup();
  return startApp(createApi({ url: apiUrl(), key: key }), 'homehub', null);
}

function showSetup() {
  render(html`<${Setup} mode=${mode} onConnect=${connect} />`, root);
}

/** Setup: trade a pairing code for the key, or check a typed key. Throws with a .code on failure. */
async function connect(way, value) {
  let key = value;
  if (way === 'code') {
    const res = await createApi({ url: apiUrl(), key: '' })('pair.redeem', { code: value });
    key = res.key;
  }
  await createApi({ url: apiUrl(), key: key })('ping', {});
  LS.set('hh.key', key);
  root.textContent = '';
  await startApp(createApi({ url: apiUrl(), key: key }), 'homehub', null);
}

async function startApp(api, dbName, demoServer) {
  await store.initStore(dbName);
  applyTheme(themeFor(store.setting));
  const draw = () => render(html`<${App} mode=${mode} demo=${!!demoServer} api=${api}
    onSignOut=${() => signOut(demoServer)} updateReady=${updateReady} />`, root);
  draw();
  startSync(api);
  if (mode === 'hub') {
    keepAwake(true);
    scheduleNightlyReload(store.setting('nightly_reload', '03:00'));
  }
}

async function signOut(demoServer) {
  if (demoServer) demoServer.reset();
  ['hh.key', 'hh.member', 'hh.demo', 'hh.url'].forEach((k) => LS.set(k, null));
  await store.wipe();
  location.href = location.pathname;
}

/** A new version of the app was downloaded: switch to it when nobody's in the middle of something. */
function onUpdate() {
  updateReady = true;
  if (mode === 'hub') {
    setInterval(() => { if (idleMs() > 2 * 60000) location.reload(); }, 30000);
  } else {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) location.reload(); });
  }
}

boot().catch((err) => {
  console.error(err);
  root.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'boot';
  box.textContent = 'Home Hub couldn\'t start: ' + (err && err.message ? err.message : err);
  root.appendChild(box);
});
