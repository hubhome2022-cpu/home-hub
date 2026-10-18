// Things about this device: hub or phone layout, light/dark/night, keeping the
// fridge screen awake, noticing when nobody's touched it, and the nightly refresh.

const LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* blocked */ } }
};
export { LS };

/* ---------- Layout mode ---------- */

/** 'hub' for a tall portrait screen (the fridge), otherwise 'phone'. ?mode=hub|phone|auto overrides and is remembered. */
export function detectMode() {
  const param = new URLSearchParams(location.search).get('mode');
  if (param === 'hub' || param === 'phone') LS.set('hh.mode', param);
  if (param === 'auto') LS.set('hh.mode', null);
  const forced = LS.get('hh.mode');
  if (forced === 'hub' || forced === 'phone') return forced;
  const w = window.innerWidth;
  const h = window.innerHeight;
  return w >= 600 && h >= w * 1.4 ? 'hub' : 'phone';
}

export function setForcedMode(mode) {
  LS.set('hh.mode', mode === 'auto' ? null : mode);
}

export function forcedMode() {
  return LS.get('hh.mode') || 'auto';
}

export function applyMode(mode) {
  document.documentElement.setAttribute('data-mode', mode);
}

/* ---------- Light / dark / night ---------- */

function minutesOf(hhmm, fallback) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback;
}

/** True between night_start and night_end (the window may cross midnight). */
export function isNightTime(start, end, now) {
  const d = now || new Date();
  const t = d.getHours() * 60 + d.getMinutes();
  const s = minutesOf(start, 21 * 60);
  const e = minutesOf(end, 5 * 60);
  return s <= e ? t >= s && t < e : t >= s || t < e;
}

/** Dark from night_start until 6 am-ish; Phase 3 switches this to real sunset times. */
export function themeFor(settingsGet, now) {
  const choice = LS.get('hh.theme') || 'auto';
  if (choice === 'light' || choice === 'dark') return choice;
  const d = now || new Date();
  const h = d.getHours();
  if (isNightTime(settingsGet('night_start', '21:00'), settingsGet('night_end', '05:00'), d)) return 'dark';
  return h >= 19 || h < 6 ? 'dark' : 'light';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#171A19' : '#F3F1EE');
}

export function themeChoice() { return LS.get('hh.theme') || 'auto'; }
export function setThemeChoice(v) { LS.set('hh.theme', v === 'auto' ? null : v); }

/* ---------- Idle tracking ---------- */

let lastTouch = Date.now();
export function markActive() { lastTouch = Date.now(); }
export function idleMs() { return Date.now() - lastTouch; }
['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach((ev) => {
  window.addEventListener(ev, markActive, { passive: true, capture: true });
});

/* ---------- Keep the hub screen on ---------- */

let wakeLock = null;
let wantWake = false;

export async function keepAwake(on) {
  wantWake = on;
  if (!('wakeLock' in navigator)) return false;
  try {
    if (on && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
    return true;
  } catch (e) {
    return false;
  }
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && wantWake) keepAwake(true);
});

/* ---------- Nightly refresh (hub) ---------- */

/** Reloads once a night at `hhmm`, but only when nobody's using it, so updates and memory stay fresh. */
export function scheduleNightlyReload(hhmm) {
  const now = new Date();
  const target = new Date(now);
  const mins = minutesOf(hhmm, 180);
  target.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const jitter = Math.floor(Math.random() * 5 * 60000);
  setTimeout(function tryReload() {
    if (idleMs() > 2 * 60000) location.reload();
    else setTimeout(tryReload, 5 * 60000);
  }, target - now + jitter);
}

/* ---------- Installable app / offline shell ---------- */

export function registerServiceWorker(onUpdate) {
  if (!('serviceWorker' in navigator)) return;
  // While developing locally, skip it (it would serve stale files) unless ?sw is in the address.
  if (location.hostname === 'localhost' && !/[?&]sw\b/.test(location.search)) {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
    return;
  }
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) onUpdate();
      });
    });
    setInterval(() => reg.update().catch(() => {}), 6 * 3600 * 1000);
  }).catch((e) => console.warn('Service worker not registered', e));
}

/* ---------- What this browser can do (shown in Settings › This device) ---------- */

export function capabilities() {
  const ua = navigator.userAgent;
  const chrome = /Chrom(e|ium)\/(\d+)/.exec(ua);
  return [
    ['Browser', ua],
    ['Chromium version', chrome ? chrome[2] : 'not Chromium'],
    ['Screen', window.innerWidth + ' × ' + window.innerHeight + ' at ' + (window.devicePixelRatio || 1) + 'x'],
    ['Saves data offline', 'indexedDB' in window ? 'Yes' : 'No'],
    ['Works without internet', 'serviceWorker' in navigator ? 'Yes' : 'No'],
    ['Keeps screen awake', 'wakeLock' in navigator ? 'Yes' : 'No'],
    ['Touch screen', ('ontouchstart' in window || navigator.maxTouchPoints > 0) ? 'Yes' : 'No']
  ];
}
