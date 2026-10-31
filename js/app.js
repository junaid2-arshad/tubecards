// Entry point: starts the store, shows sign-in or the tabbed app, and registers the offline worker.

import * as store from './store.js';
import { h, clear, icon } from './ui.js';
import { applyTheme } from './theme.js';
import { unlockSpeech } from './speech.js';
import { mountAuth } from './views/auth.js';
import * as study from './views/study.js';
import * as cards from './views/cards.js';
import * as practice from './views/practice.js';
import * as statsView from './views/statsview.js';
import * as more from './views/more.js';

const ROUTES = {
  study: { label: 'Study', icon: 'study', mod: study },
  practice: { label: 'Practice', icon: 'target', mod: practice },
  cards: { label: 'Cards', icon: 'cards', mod: cards },
  stats: { label: 'Stats', icon: 'stats', mod: statsView },
  more: { label: 'More', icon: 'more', mod: more },
};

const app = document.getElementById('app');
let viewEl = null;
let tabsEl = null;
let current = null;
let top = null;

const routeName = () => {
  const m = location.hash.match(/^#\/(\w+)/);
  return m && ROUTES[m[1]] ? m[1] : 'study';
};

function destroyCurrent() {
  try {
    current?.destroy?.();
    top?.destroy?.();
  } catch (e) {
    console.error(e);
  }
  current = null;
  top = null;
}

function showRoute() {
  if (!viewEl) return;
  try {
    current?.destroy?.();
  } catch (e) {
    console.error(e);
  }
  clear(viewEl);
  const name = routeName();
  document.title = `${ROUTES[name].label} · TubeCards`;
  tabsEl.querySelectorAll('a').forEach((a) => {
    const on = a.dataset.route === name;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
  try {
    current = ROUTES[name].mod.mount(viewEl, {});
  } catch (e) {
    console.error(e);
    viewEl.append(h('div', { class: 'view' }, h('p', { class: 'notice', role: 'alert' }, 'Something went wrong drawing this screen. Reload the app and try again.')));
  }
}

function renderApp() {
  destroyCurrent();
  clear(app);
  viewEl = tabsEl = null;
  const { state } = store;
  if (!state.user) {
    top = mountAuth(app);
    return;
  }
  if (!state.ready) {
    app.append(h('p', { class: 'boot', role: 'status' }, 'Loading your cards…'));
    return;
  }
  viewEl = h('div', { id: 'view' });
  tabsEl = h(
    'nav',
    { class: 'tabs', 'aria-label': 'Main' },
    Object.entries(ROUTES).map(([key, r]) => h('a', { href: `#/${key}`, 'data-route': key }, icon(r.icon, 24), h('span', null, r.label))),
  );
  const offline = h('div', { class: 'offline-banner', id: 'offline', role: 'status' }, 'You are offline. Your answers are saved and will sync when you reconnect.');
  app.append(offline, viewEl, tabsEl);
  syncOffline();
  if (state.backendName === 'local') app.prepend(h('div', { class: 'demo-banner' }, 'Demo mode: data stays on this device'));
  showRoute();
}

function syncOffline() {
  document.getElementById('offline')?.classList.toggle('show', navigator.onLine === false);
}
window.addEventListener('online', syncOffline);
window.addEventListener('offline', syncOffline);
window.addEventListener('hashchange', () => viewEl && showRoute());

store.subscribe((kinds) => {
  if (kinds.includes('auth') || kinds.includes('ready')) {
    applyTheme();
    return renderApp();
  }
  if (kinds.includes('settings')) applyTheme();
  current?.update?.(kinds);
});

// iPhone only allows speech after a tap; this unlocks it once.
document.addEventListener('pointerdown', () => unlockSpeech(), { once: true });

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Offline mode unavailable', e)));
}

try {
  await store.init();
  applyTheme();
  renderApp();
} catch (e) {
  console.error(e);
  clear(app);
  app.append(h('p', { class: 'notice', role: 'alert' }, 'The app could not start: ' + (e?.message || e)));
}
