// Sign-in screen. There is deliberately no "create account" button: you create your own
// account once in the Firebase console, so nobody else can register.

import { h, field, icon } from '../ui.js';
import * as store from '../store.js';

export function mountAuth(el) {
  const email = h('input', { class: 'input', type: 'email', autocomplete: 'username', autocapitalize: 'off', inputmode: 'email', required: true });
  const password = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', required: true });
  const error = h('p', { class: 'form-error', role: 'alert' });
  const info = h('p', { class: 'ok-text', 'aria-live': 'polite' });
  const btn = h('button', { class: 'btn primary big', type: 'submit' }, 'Sign in');

  async function submit(e) {
    e.preventDefault();
    error.textContent = '';
    info.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      await store.signIn(email.value.trim(), password.value);
    } catch (err) {
      error.textContent = store.friendlyAuthError(err);
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  }

  async function forgot() {
    error.textContent = '';
    info.textContent = '';
    if (!email.value.trim()) {
      error.textContent = 'Enter your email first, then tap this again.';
      return;
    }
    try {
      await store.resetPassword(email.value.trim());
      info.textContent = 'If that address has an account, a reset link is on its way.';
    } catch (err) {
      error.textContent = store.friendlyAuthError(err);
    }
  }

  el.append(
    h(
      'div',
      { class: 'auth' },
      h('div', { class: 'brand' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, icon('study', 28)), h('h1', null, 'TubeCards')),
      h('p', { class: 'dim' }, 'Your GRE and Italian cards, ready for the journey.'),
      store.state.loadError ? h('p', { class: 'notice', role: 'alert' }, store.state.loadError) : null,
      h('form', { class: 'stack', onsubmit: submit }, field('Email', email), field('Password', password), error, info, btn, h('button', { type: 'button', class: 'link', onclick: forgot }, 'Forgot your password?')),
    ),
  );
  return { destroy() {} };
}
