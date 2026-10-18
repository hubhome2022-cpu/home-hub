import { useState, useEffect, useReducer, createContext, useContext } from '../vendor.js';
import * as store from '../store.js';
import { getStatus, onStatus } from '../sync.js';

/** App-wide things screens need: who's using it, the API, toasts, layout mode. */
export const AppCtx = createContext(null);
export function useApp() { return useContext(AppCtx); }

/** Re-renders whenever local data changes. Read with store.rows()/store.row() inside the component. */
export function useData() {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => store.subscribe(force), []);
}

export function useSyncStatus() {
  const [s, set] = useState(() => Object.assign({}, getStatus()));
  useEffect(() => onStatus((next) => set(Object.assign({}, next))), []);
  return s;
}

/** Current time, refreshed every `ms` (aligned to the next whole minute by default). */
export function useNow(ms) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let t;
    const tick = () => {
      setNow(new Date());
      const step = ms || (60000 - (Date.now() % 60000));
      t = setTimeout(tick, step);
    };
    t = setTimeout(tick, ms || (60000 - (Date.now() % 60000)));
    return () => clearTimeout(t);
  }, [ms]);
  return now;
}

export function useRoute() {
  const read = () => (location.hash.replace(/^#\/?/, '') || 'home').split('?')[0];
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

/* ---------- Small formatting helpers ---------- */

export function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function timeParts(d) {
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return { time: h + ':' + String(d.getMinutes()).padStart(2, '0'), ampm: ampm };
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function longDate(d) { return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate(); }
export function shortDate(d) { return DAYS[d.getDay()].slice(0, 3) + ', ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate(); }

export function greeting(d) {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function relativeTime(iso) {
  if (!iso) return 'never';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  return shortDate(new Date(iso));
}

export function members() {
  return store.rows('Members')
    .filter((m) => m.active !== false)
    .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
}
