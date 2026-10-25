// Small DOM helpers. All user text goes in through text nodes, never innerHTML.

const SVG_NS = 'http://www.w3.org/2000/svg';
const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'readOnly', 'multiple']);

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (PROPS.has(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}

export function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function svg(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const k of kids.flat(Infinity)) if (k != null) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
}

const ICONS = {
  study: 'M4 7.5 12 4l8 3.5-8 3.5-8-3.5Z M4 12l8 3.5 8-3.5 M4 16.5 12 20l8-3.5',
  cards: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z M8 9h8 M8 13h8 M8 17h5',
  speak: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z M6 11a6 6 0 0 0 12 0 M12 17v4 M9 21h6',
  stats: 'M5 20V11 M12 20V4 M19 20v-6',
  more: 'M4 7h10 M18 7h2 M4 17h2 M10 17h10 M14 5v4 M6 15v4',
  play: 'M7 5v14l12-7Z',
  pause: 'M8 5v14 M16 5v14',
  next: 'M6 5v14l9-7Z M18 5v14',
  prev: 'M18 5v14l-9-7Z M6 5v14',
  speaker: 'M4 10v4h4l5 4V6l-5 4H4Z M16 9a4 4 0 0 1 0 6 M18.5 6.5a8 8 0 0 1 0 11',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z M6 11a6 6 0 0 0 12 0 M12 17v4',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  x: 'M6 6l12 12 M18 6 6 18',
  undo: 'M9 14 4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Z M13.5 6.5l4 4',
  plus: 'M12 5v14 M5 12h14',
  upload: 'M12 16V4 M7 9l5-5 5 5 M5 20h14',
  download: 'M12 4v12 M7 11l5 5 5-5 M5 20h14',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z M20 20l-4-4',
  trash: 'M5 7h14 M9 7V4h6v3 M7 7l1 13h8l1-13',
  flame: 'M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9Z',
  flip: 'M4 12a8 8 0 0 1 14-5l2 2 M20 4v5h-5 M20 12a8 8 0 0 1-14 5l-2-2 M4 20v-5h5',
  dash: 'M6 12h12',
  tilde: 'M5 13c2-3 4-3 7 0s5 3 7 0',
  warn: 'M12 4 3 20h18L12 4Z M12 10v4 M12 17h.01',
  lock: 'M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  eyeoff: 'M3 3l18 18 M10 6.2A9 9 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.4 3.9 M6.3 7.6A17 17 0 0 0 2 12s4 6 10 6a9 9 0 0 0 3.2-.6',
};

export function icon(name, size = 22) {
  const s = svg('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' });
  s.append(svg('path', { d: ICONS[name] || '' }));
  return s;
}

// ---------- toast ----------
let toastTimer = null;
export function toast(message, { action, onAction, ms = 3500 } = {}) {
  let box = document.getElementById('toast');
  if (!box) {
    box = h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(box);
  }
  clear(box);
  box.append(h('span', null, message));
  if (action) {
    box.append(
      h('button', { class: 'toast-action', onclick: () => { box.classList.remove('show'); onAction?.(); } }, action),
    );
  }
  box.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('show'), ms);
}

// ---------- sheet (bottom drawer) ----------
export function openSheet({ title, content, onClose, wide = false }) {
  const backdrop = h('div', { class: 'backdrop' });
  const body = h('div', { class: 'sheet-body' }, content);
  const closeBtn = h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => close() }, icon('x'));
  const sheet = h('div', { class: 'sheet' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('div', { class: 'sheet-head' }, h('h2', null, title), closeBtn), body);
  let closed = false;
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    sheet.remove();
    onClose?.();
  }
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop, sheet);
  requestAnimationFrame(() => {
    backdrop.classList.add('show');
    sheet.classList.add('show');
  });
  return { close, el: sheet, body };
}

export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const done = (v) => {
      if (answered) return;
      answered = true;
      resolve(v);
      s.close();
    };
    const s = openSheet({
      title,
      onClose: () => {
        if (!answered) {
          answered = true;
          resolve(false);
        }
      },
      content: h('div', { class: 'stack' }, h('p', null, message), h('div', { class: 'row end' }, h('button', { class: 'btn ghost', onclick: () => done(false) }, 'Cancel'), h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => done(true) }, confirmLabel))),
    });
  });
}

// ---------- small widgets ----------
export function segmented({ options, value, onChange, label }) {
  const wrap = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label || '' });
  const buttons = options.map((o) =>
    h(
      'button',
      {
        type: 'button',
        role: 'radio',
        'aria-checked': String(o.value === value),
        class: o.value === value ? 'on' : '',
        onclick: () => {
          value = o.value;
          buttons.forEach((b, i) => {
            const on = options[i].value === value;
            b.classList.toggle('on', on);
            b.setAttribute('aria-checked', String(on));
          });
          onChange(value);
        },
      },
      o.label,
    ),
  );
  wrap.append(...buttons);
  return wrap;
}

export function field(label, control, help) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), control, help ? h('span', { class: 'field-help' }, help) : null);
}

export function download(filename, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const KIND_LABEL = { gre: 'GRE word', italian: 'Italian', basic: 'Basic' };

// Field labels depend on the card type, so the editor says what each box is for.
export const FIELD_LABELS = {
  gre: { front: 'Word', hint: 'Example sentence (shown with the word)', back: 'Meaning', notes: 'Synonyms or notes (shown on the back)' },
  italian: { front: 'Italian', hint: 'Italian example sentence (shown with the phrase)', back: 'English', notes: 'Notes (shown on the back)' },
  basic: { front: 'Front', hint: 'Hint (optional, shown on the front)', back: 'Back', notes: 'Notes (optional)' },
};

export const deckColor = (kind) => (kind === 'gre' ? 'var(--gre)' : kind === 'italian' ? 'var(--ita)' : 'var(--basic)');

export function deckDot(kind) {
  return h('span', { class: 'dot', style: { background: deckColor(kind) }, 'aria-hidden': 'true' });
}

// Render text with one word underlined (the vocabulary word inside its example sentence).
export function emphasise(text, word) {
  if (!text || !word) return text;
  const i = text.toLowerCase().indexOf(String(word).toLowerCase().slice(0, Math.max(4, Math.min(word.length, 7))));
  if (i < 0) return text;
  // extend to the end of the word the stem sits in
  let j = i;
  while (j < text.length && /[\p{L}'’-]/u.test(text[j])) j++;
  return [text.slice(0, i), h('mark', null, text.slice(i, j)), text.slice(j)];
}
