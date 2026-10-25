import { state } from './store.js';

// Light, dark, or follow the phone.
export function applyTheme() {
  const t = state.settings.theme;
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
  else root.removeAttribute('data-theme');
  try {
    localStorage.setItem('tubecards.theme', t);
  } catch {
    /* ignore */
  }
  const dark = t === 'dark' || (t === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0d1520' : '#e8edf0');
}
