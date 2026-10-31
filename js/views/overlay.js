// A full-screen layer for guided activities (Learn, fill the blank, questions, sentences).
// It has a close button, a progress bar, a stage for content and a control area at the bottom.

import { h, icon, clear, confirmDialog } from '../ui.js';
import { stopSpeaking } from '../speech.js';

// opts: { title, onExit }
export function openOverlay({ title, onExit }) {
  let closed = false;
  let progress = 0;
  const fill = h('div', { class: 'route-bar-fill', style: { width: '0%' } });
  const label = h('div', { class: 'session-meta', 'aria-live': 'polite' });
  const closeBtn = h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => request() }, icon('x'));
  const stage = h('main', { class: 'stage' });
  const controls = h('footer', { class: 'controls' });
  const root = h('div', { class: 'session', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('header', { class: 'session-head' }, closeBtn, h('div', { class: 'route-wrap' }, h('div', { class: 'route-bar' }, fill), label)), stage, controls);
  document.body.append(root);
  document.body.classList.add('in-session');

  const onKey = (e) => {
    if (document.querySelector('.sheet.show')) return;
    if (e.key === 'Escape') request();
  };
  document.addEventListener('keydown', onKey);

  function finish() {
    if (closed) return;
    closed = true;
    stopSpeaking();
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('in-session');
    root.remove();
    onExit?.();
  }

  async function request() {
    if (closed) return;
    if (progress <= 0.02) return finish();
    const ok = await confirmDialog({ title: 'Stop here?', message: 'Answers you have already given are saved.', confirmLabel: 'Stop' });
    if (ok) finish();
  }

  return {
    stage,
    controls,
    // fraction 0..1, and a short text such as "Fill the blank · 2 of 5"
    setProgress(fraction, text) {
      progress = fraction;
      fill.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
      label.textContent = text || '';
    },
    reset() {
      clear(stage);
      clear(controls);
      stage.scrollTop = 0;
    },
    close: finish,
    get closed() {
      return closed;
    },
  };
}
