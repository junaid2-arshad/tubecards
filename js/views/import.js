// Import sheet: paste or upload this week's content.

import { h, field, segmented, openSheet, toast, download, clear } from '../ui.js';
import * as store from '../store.js';
import { parseCards, parseJsonCards, TEMPLATES } from '../csv.js';
import { isoWeek } from '../srs.js';

const PLACEHOLDER = `Paste a table with a header row:
deck,type,front,hint,back,notes,tags
GRE Vocab,gre,ephemeral,"Fame can be ephemeral.",lasting a very short time,transient,

or quick lines with no header (front | back | sentence | notes):
ephemeral | lasting a very short time | Fame can be ephemeral. | transient`;

export function openImport({ onDone } = {}) {
  let mode = 'update';
  const text = h('textarea', { class: 'input mono', rows: 8, placeholder: PLACEHOLDER, 'aria-label': 'Cards to import', spellcheck: 'false' });
  const file = h('input', { type: 'file', accept: '.csv,.tsv,.txt,.json,text/csv,text/plain,application/json', class: 'file-input', 'aria-label': 'Choose a file' });
  const deckName = h('input', { class: 'input', type: 'text', list: 'deck-names', placeholder: 'Used for lines without a deck', value: store.deckList()[0]?.name || '' });
  const datalist = h('datalist', { id: 'deck-names' }, store.deckList().map((d) => h('option', { value: d.name })));
  const week = h('input', { class: 'input', type: 'text', value: isoWeek(Date.now()), 'aria-label': 'Week label' });
  const status = h('div', { class: 'import-status', 'aria-live': 'polite' });
  const importBtn = h('button', { class: 'btn primary', disabled: true }, 'Import');
  let parsed = { cards: [], errors: [] };

  function parse() {
    const raw = text.value;
    clear(status);
    if (!raw.trim()) {
      parsed = { cards: [], errors: [] };
      importBtn.disabled = true;
      importBtn.textContent = 'Import';
      return;
    }
    const defaults = { deck: deckName.value.trim() || 'GRE Vocab' };
    parsed = /^\s*[[{]/.test(raw) ? parseJsonCards(raw, defaults) : parseCards(raw, defaults);
    for (const c of parsed.cards) if (!c.batch) c.batch = week.value.trim() || isoWeek(Date.now());
    const n = parsed.cards.length;
    importBtn.disabled = n === 0;
    importBtn.textContent = n ? `Import ${n} ${n === 1 ? 'card' : 'cards'}` : 'Import';
    status.append(h('p', { class: n ? 'ok-text' : 'dim' }, n ? `${n} ${n === 1 ? 'card is' : 'cards are'} ready.` : 'No usable cards found yet.'));
    if (parsed.errors.length) {
      status.append(h('p', { class: 'form-error' }, `${parsed.errors.length} ${parsed.errors.length === 1 ? 'line was' : 'lines were'} skipped:`), h('ul', { class: 'plain-list' }, parsed.errors.slice(0, 5).map((e) => h('li', null, e.line ? `Line ${e.line}: ${e.msg}` : e.msg))));
    }
  }
  for (const el of [text, deckName, week]) el.addEventListener('input', parse);

  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    text.value = await f.text();
    parse();
  });

  importBtn.addEventListener('click', () => {
    if (!parsed.cards.length) return;
    const r = store.importCards(parsed.cards, { mode });
    const parts = [`${r.added} added`];
    if (r.updated) parts.push(`${r.updated} updated`);
    if (r.skipped) parts.push(`${r.skipped} skipped`);
    toast(parts.join(', '));
    onDone?.(r);
    sheet.close();
  });

  const content = h(
    'div',
    { class: 'stack' },
    h('p', { class: 'dim' }, 'Paste your list, or choose a CSV, TSV or JSON file. Cards you already have are matched by deck and front, and keep their study progress.'),
    text,
    h('div', { class: 'row wrap' }, file),
    datalist,
    field('Deck for lines without one', deckName),
    field('Week label for this batch', week, 'Lets you study just this week’s additions.'),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'If a card already exists'), segmented({ label: 'Existing cards', value: mode, options: [{ value: 'update', label: 'Update the text' }, { value: 'skip', label: 'Leave it alone' }], onChange: (v) => (mode = v) })),
    status,
    h('div', { class: 'row end wrap' }, h('button', { class: 'btn ghost', onclick: () => download('gre-template.csv', TEMPLATES.gre, 'text/csv') }, 'Template (CSV)'), importBtn),
  );
  const sheet = openSheet({ title: 'Import cards', content, wide: true });
  return sheet;
}
