// Add / edit card sheet.

import { h, field, segmented, openSheet, confirmDialog, toast, FIELD_LABELS, clear } from '../ui.js';
import * as store from '../store.js';
import { renderFace } from './face.js';

const NEW_DECK = '__new__';

// opts: { cardId } to edit, or { deckId, kind } to add. onSaved(card) is optional.
export function openCardEditor(opts = {}) {
  const editing = opts.cardId ? store.state.cards.get(opts.cardId) : null;
  const decks = store.deckList();
  let kind = editing?.kind || opts.kind || decks.find((d) => d.id === opts.deckId)?.kind || 'gre';

  const deckSel = h('select', { class: 'input', 'aria-label': 'Deck' });
  const fillDecks = (selected) => {
    clear(deckSel);
    for (const d of store.deckList()) deckSel.append(h('option', { value: d.id, selected: d.id === selected }, d.name));
    deckSel.append(h('option', { value: NEW_DECK }, 'New deck…'));
  };
  fillDecks(editing?.deckId || opts.deckId || decks.find((d) => d.kind === kind)?.id || decks[0]?.id || NEW_DECK);
  const newDeckName = h('input', { class: 'input', type: 'text', placeholder: 'Deck name, e.g. GRE Vocab', 'aria-label': 'New deck name' });
  const newDeckRow = h('div', { class: 'hidden' }, field('New deck name', newDeckName));
  const syncNewDeck = () => newDeckRow.classList.toggle('hidden', deckSel.value !== NEW_DECK);
  deckSel.addEventListener('change', syncNewDeck);
  syncNewDeck();

  const front = h('textarea', { class: 'input', rows: 2, value: editing?.front || '' });
  const hint = h('textarea', { class: 'input', rows: 2, value: editing?.hint || '' });
  const back = h('textarea', { class: 'input', rows: 2, value: editing?.back || '' });
  const notes = h('textarea', { class: 'input', rows: 2, value: editing?.notes || '' });
  const tags = h('input', { class: 'input', type: 'text', value: (editing?.tags || []).join(', '), placeholder: 'optional, comma separated' });
  const paused = h('input', { type: 'checkbox', checked: !!editing?.suspended });

  const labels = { front: h('span', { class: 'field-label' }), hint: h('span', { class: 'field-label' }), back: h('span', { class: 'field-label' }), notes: h('span', { class: 'field-label' }) };
  const wrap = (key, control) => h('label', { class: 'field' }, labels[key], control);
  const setLabels = () => {
    for (const k of Object.keys(labels)) labels[k].textContent = FIELD_LABELS[kind][k];
  };
  setLabels();

  const preview = h('div', { class: 'preview-pair' });
  const draft = () => ({
    id: editing?.id || 'preview',
    deckId: deckSel.value === NEW_DECK ? '' : deckSel.value,
    kind,
    front: front.value.trim() || '…',
    hint: hint.value.trim(),
    back: back.value.trim() || '…',
    notes: notes.value.trim(),
    tags: [],
    suspended: false,
  });
  const drawPreview = () => {
    clear(preview);
    const c = draft();
    preview.append(h('div', { class: 'preview-col' }, h('span', { class: 'field-label' }, 'Front'), renderFace(c, 'front')), h('div', { class: 'preview-col' }, h('span', { class: 'field-label' }, 'Back'), renderFace(c, 'back')));
  };
  for (const el of [front, hint, back, notes, deckSel]) el.addEventListener('input', drawPreview);
  deckSel.addEventListener('change', drawPreview);

  const typeSeg = segmented({
    label: 'Card type',
    options: [
      { value: 'gre', label: 'GRE word' },
      { value: 'italian', label: 'Italian' },
      { value: 'basic', label: 'Basic' },
    ],
    value: kind,
    onChange: (v) => {
      kind = v;
      setLabels();
      drawPreview();
    },
  });

  const error = h('p', { class: 'form-error', role: 'alert' });

  function save(addAnother) {
    error.textContent = '';
    if (!front.value.trim() || !back.value.trim()) {
      error.textContent = 'Fill in both the front and the back.';
      return;
    }
    let deckId = deckSel.value;
    if (deckId === NEW_DECK) {
      if (!newDeckName.value.trim()) {
        error.textContent = 'Name the new deck.';
        return;
      }
      deckId = store.ensureDeck(newDeckName.value, kind).id;
    }
    const patch = {
      deckId,
      kind,
      front: front.value,
      hint: hint.value,
      back: back.value,
      notes: notes.value,
      tags: tags.value.split(',').map((t) => t.trim()).filter(Boolean),
    };
    let card;
    if (editing) {
      card = store.updateCard(editing.id, { ...patch, suspended: paused.checked });
      toast('Card saved');
    } else {
      card = store.addCard(patch);
      toast('Card added');
    }
    opts.onSaved?.(card);
    if (addAnother && !editing) {
      front.value = hint.value = back.value = notes.value = '';
      fillDecks(deckId);
      drawPreview();
      front.focus();
    } else sheet.close();
  }

  async function remove() {
    const ok = await confirmDialog({ title: 'Delete this card?', message: `"${editing.front}" and its study history will be removed.`, confirmLabel: 'Delete card', danger: true });
    if (!ok) return;
    store.removeCards([editing.id]);
    toast('Card deleted');
    opts.onDeleted?.(editing.id);
    sheet.close();
  }

  const content = h(
    'form',
    { class: 'stack', onsubmit: (e) => e.preventDefault() },
    field('Type', typeSeg),
    field('Deck', deckSel),
    newDeckRow,
    wrap('front', front),
    wrap('hint', hint),
    wrap('back', back),
    wrap('notes', notes),
    field('Tags', tags),
    editing ? h('label', { class: 'check' }, paused, h('span', null, 'Pause this card (leave it out of study sessions)')) : null,
    preview,
    error,
    h(
      'div',
      { class: 'row end wrap' },
      editing ? h('button', { type: 'button', class: 'btn danger-ghost', onclick: remove }, 'Delete') : null,
      !editing ? h('button', { type: 'button', class: 'btn ghost', onclick: () => save(true) }, 'Save and add another') : null,
      h('button', { type: 'button', class: 'btn primary', onclick: () => save(false) }, 'Save card'),
    ),
  );
  const sheet = openSheet({ title: editing ? 'Edit card' : 'Add a card', content, wide: true });
  drawPreview();
  setTimeout(() => front.focus({ preventScroll: true }), 80);
  return sheet;
}
