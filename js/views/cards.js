// Cards tab: browse, search, add, edit and import.

import { h, clear, icon, deckDot, toast } from '../ui.js';
import * as store from '../store.js';
import { addDays, daysBetween } from '../srs.js';
import { openCardEditor } from './editor.js';
import { openImport } from './import.js';

const view = { q: '', deck: 'all', week: 'all', shown: 60 };

function status(card, now) {
  if (card.suspended) return { text: 'Paused', cls: 'muted' };
  const s = card.srs;
  if (!s || s.state === 'new') return { text: 'New', cls: 'new' };
  if (s.state === 'learning') return { text: 'Learning', cls: 'due' };
  if (s.due < addDays(now, 1)) return { text: 'Due', cls: 'due' };
  return { text: `In ${daysBetween(now, s.due)}d`, cls: 'ok' };
}

export function mount(el) {
  let searchInput = null;

  function render() {
    const keepFocus = document.activeElement === searchInput;
    clear(el);
    const now = Date.now();
    const all = store.cardList();
    const decks = store.deckList();
    const root = h('div', { class: 'view' });
    el.append(root);

    root.append(
      h(
        'div',
        { class: 'view-head' },
        h('h1', null, 'Cards'),
        h('div', { class: 'row' }, h('button', { class: 'icon-btn', 'aria-label': 'Import cards', onclick: () => openImport({}) }, icon('upload')), h('button', { class: 'btn primary small', onclick: () => openCardEditor({ deckId: view.deck !== 'all' ? view.deck : undefined }) }, icon('plus', 18), 'Add')),
      ),
    );

    if (!all.length) {
      root.append(h('section', { class: 'panel empty' }, h('h2', null, 'Nothing here yet'), h('p', null, 'Add a card by hand, import a list, or load the sample set.'), h('div', { class: 'row wrap' }, h('button', { class: 'btn primary', onclick: () => openCardEditor({}) }, 'Add a card'), h('button', { class: 'btn ghost', onclick: () => openImport({}) }, 'Import'), h('button', { class: 'btn ghost', onclick: () => { const r = store.loadSample(); toast(`Loaded ${r.added} sample cards`); } }, 'Load samples'))));
      return;
    }

    searchInput = h('input', { class: 'input', type: 'search', placeholder: 'Search words', value: view.q, 'aria-label': 'Search words', oninput: (e) => { view.q = e.target.value; view.shown = 60; renderList(); } });
    const deckSel = h('select', { class: 'input', 'aria-label': 'Deck', onchange: (e) => { view.deck = e.target.value; view.shown = 60; renderList(); } }, h('option', { value: 'all' }, 'All decks'), decks.map((d) => h('option', { value: d.id, selected: view.deck === d.id }, d.name)));
    const weeks = [...new Set(all.map((c) => c.batch).filter(Boolean))].sort().reverse();
    const weekSel = h('select', { class: 'input', 'aria-label': 'Week added', onchange: (e) => { view.week = e.target.value; view.shown = 60; renderList(); } }, h('option', { value: 'all' }, 'Any week'), weeks.map((w) => h('option', { value: w, selected: view.week === w }, w)));
    root.append(h('div', { class: 'stack tight' }, searchInput, h('div', { class: 'grid2' }, deckSel, weekSel)));

    const count = h('p', { class: 'dim count-line', 'aria-live': 'polite' });
    const list = h('div', { class: 'list' });
    root.append(count, list);

    function renderList() {
      clear(list);
      const q = view.q.trim().toLowerCase();
      const rows = store
        .cardList()
        .filter((c) => (view.deck === 'all' || c.deckId === view.deck) && (view.week === 'all' || c.batch === view.week))
        .filter((c) => !q || [c.front, c.back, c.hint, c.notes, c.hook, (c.tags || []).join(' ')].join(' ').toLowerCase().includes(q))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0) || a.front.localeCompare(b.front));
      count.textContent = `${rows.length} ${rows.length === 1 ? 'card' : 'cards'}`;
      if (!rows.length) list.append(h('p', { class: 'dim pad' }, 'No cards match.'));
      for (const c of rows.slice(0, view.shown)) {
        const st = status(c, now);
        list.append(
          h(
            'button',
            { class: 'card-row', onclick: () => openCardEditor({ cardId: c.id }) },
            deckDot(),
            h('span', { class: 'row-main' }, h('strong', null, c.front), h('span', { class: 'dim clamp' }, c.back)),
            h('span', { class: `pill ${st.cls}` }, st.text),
          ),
        );
      }
      if (rows.length > view.shown) list.append(h('button', { class: 'btn ghost', onclick: () => { view.shown += 60; renderList(); } }, `Show more (${rows.length - view.shown} left)`));
    }
    renderList();
    if (keepFocus) searchInput.focus();
  }

  render();
  let t = null;
  return {
    update(kinds) {
      if (!kinds.some((k) => ['cards', 'decks', 'ready'].includes(k))) return;
      // do not redraw under the sheet while someone is typing
      clearTimeout(t);
      t = setTimeout(render, 60);
    },
    destroy() {
      clearTimeout(t);
    },
  };
}
