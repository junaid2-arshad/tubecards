// More tab: account, study settings, voices, content tools, decks and a short guide.

import { h, clear, field, segmented, toast, download, confirmDialog, icon, deckDot } from '../ui.js';
import * as store from '../store.js';
import { exportCardsCsv } from '../csv.js';
import { voicesFor, loadVoices, unlockSpeech } from '../speech.js';
import { speakText } from './audio.js';
import { openImport } from './import.js';
import { openCardEditor } from './editor.js';
import { applyTheme } from '../theme.js';

export function mount(el) {
  async function render() {
    clear(el);
    const st = store.state;
    const root = h('div', { class: 'view' });
    el.append(root);
    root.append(h('div', { class: 'view-head' }, h('h1', null, 'More')));

    // account
    const demo = st.backendName === 'local';
    root.append(
      h(
        'section',
        { class: 'panel' },
        h('h2', null, 'Account'),
        demo
          ? h('p', { class: 'notice' }, 'Demo mode: sign-in is off and your cards stay on this device only. Add your Firebase details in js/firebase-config.js to turn on sign-in and sync across devices (see the README).')
          : h('p', null, 'Signed in as ', h('strong', null, st.user?.email || '')),
        !demo ? h('button', { class: 'btn ghost', onclick: () => store.signOut() }, icon('lock', 18), 'Sign out') : null,
      ),
    );

    // study settings
    const s = st.settings;
    const set = (patch) => store.saveSettings(patch);
    const num = (v, opts) => h('select', { class: 'input', onchange: (e) => set({ [opts.key]: Number(e.target.value) }) }, opts.values.map((x) => h('option', { value: x, selected: Number(v) === x }, opts.label(x))));
    const exam = h('input', { class: 'input', type: 'date', value: s.examDate || '', onchange: (e) => set({ examDate: e.target.value }) });
    root.append(
      h(
        'section',
        { class: 'panel stack' },
        h('h2', null, 'Study'),
        field('Words per review', num(s.sessionSize, { key: 'sessionSize', values: [10, 20, 30, 50, 80], label: (x) => `${x} cards` })),
        field('Longest gap between reviews', num(s.maxInterval, { key: 'maxInterval', values: [30, 90, 180, 365], label: (x) => `${x} days` })),
        field('GRE exam date', exam, 'Optional. As the date approaches, words come back more often so each one is seen several times before the test.'),
        field('New words per Learn round', num(s.learnBatch, { key: 'learnBatch', values: [3, 5, 8, 10], label: (x) => `${x} words` }), 'Small rounds work better than long lists. Five is a good start.'),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.autoSpeak, onchange: (e) => set({ autoSpeak: e.target.checked }) }), h('span', null, 'Say each word out loud when it appears')),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Appearance'), segmented({ label: 'Appearance', value: s.theme, options: [{ value: 'auto', label: 'Match phone' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }], onChange: (v) => { set({ theme: v }); applyTheme(); } })),
      ),
    );

    // decks
    const decks = store.deckList();
    if (decks.length) {
      root.append(
        h(
          'section',
          { class: 'panel stack' },
          h('h2', null, 'Decks'),
          h('p', { class: 'dim' }, 'New cards per day is set for each deck.'),
          decks.map((d) => {
            const count = store.cardList().filter((c) => c.deckId === d.id).length;
            return h(
              'div',
              { class: 'deck-edit' },
              h('div', { class: 'deck-edit-head' }, deckDot(), h('input', { class: 'input', type: 'text', value: d.name, 'aria-label': 'Deck name', onchange: (e) => e.target.value.trim() && store.updateDeck(d.id, { name: e.target.value.trim() }) }), h('span', { class: 'dim' }, `${count}`)),
              h('div', { class: 'row' }, h('label', { class: 'field inline' }, h('span', { class: 'field-label' }, 'New per day'), h('input', { class: 'input narrow', type: 'number', min: 0, max: 100, value: d.newPerDay ?? s.newPerDay, onchange: (e) => store.updateDeck(d.id, { newPerDay: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }) })), h('button', { class: 'btn danger-ghost small', onclick: async () => { if (await confirmDialog({ title: `Delete “${d.name}”?`, message: `This removes the deck and its ${count} ${count === 1 ? 'card' : 'cards'}. Answer history is kept.`, confirmLabel: 'Delete deck', danger: true })) { store.deleteDeck(d.id); toast('Deck deleted'); } } }, 'Delete')),
            );
          }),
        ),
      );
    }

    // voices
    await loadVoices();
        const en = voicesFor('en');
    const voiceSel = (list, key, current) => h('select', { class: 'input', onchange: (e) => set({ [key]: e.target.value }) }, h('option', { value: '' }, 'Automatic'), list.map((v) => h('option', { value: v.voiceURI, selected: current === v.voiceURI }, `${v.name} (${v.lang})`)));
    root.append(
      h(
        'section',
        { class: 'panel stack' },
        h('h2', null, 'Voices'),
        en.length ? field('Voice', voiceSel(en, 'enVoiceURI', s.enVoiceURI)) : null,
        en.length ? h('button', { class: 'btn ghost', onclick: () => { unlockSpeech(); speakText('Ubiquitous means found everywhere.'); } }, icon('speaker', 18), 'Test voice') : h('p', { class: 'notice' }, 'No English voice found on this device.'),
      ),
    );

    // old Italian cards
    const legacy = store.legacyCount();
    if (legacy) {
      root.append(
        h('section', { class: 'panel stack' }, h('h2', null, 'Old Italian cards'), h('p', null, `${legacy} ${legacy === 1 ? 'card' : 'cards'} from the earlier version are hidden. You can delete them for good.`), h('button', { class: 'btn danger-ghost', onclick: async () => { if (await confirmDialog({ title: 'Delete old Italian cards?', message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true })) { store.deleteLegacy(); toast('Deleted'); render(); } } }, 'Delete them')),
      );
    }

    // content tools
    root.append(
      h(
        'section',
        { class: 'panel stack' },
        h('h2', null, 'Your content'),
        h('div', { class: 'row wrap' }, h('button', { class: 'btn ghost', onclick: () => openImport({}) }, icon('upload', 18), 'Import words'), h('button', { class: 'btn ghost', onclick: () => openCardEditor({}) }, icon('plus', 18), 'Add a word'), h('button', { class: 'btn ghost', onclick: () => { const r = store.loadSample(); toast(r.added ? `Loaded ${r.added} sample words` : 'Sample cards are already loaded'); } }, 'Load sample words')),
        h('div', { class: 'row wrap' }, h('button', { class: 'btn ghost', onclick: () => download('tubecards-cards.csv', exportCardsCsv(store.cardList(), store.state.decks), 'text/csv') }, icon('download', 18), 'Export words (CSV)'), h('button', { class: 'btn ghost', onclick: () => download(`tubecards-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.exportBackup()), 'application/json') }, icon('download', 18), 'Full backup (JSON)')),
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Restore from a backup'), h('input', { type: 'file', accept: '.json,application/json', class: 'file-input', onchange: async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const r = store.restoreBackup(JSON.parse(await f.text())); toast(`Restored ${r.cards} cards`); } catch (err) { toast(err.message || 'Could not read that file'); } e.target.value = ''; } })),
      ),
    );

    // guide
    root.append(
      h(
        'section',
        { class: 'panel stack' },
        h('h2', null, 'How it works'),
        h(
          'details',
          null,
          h('summary', null, 'How cards are scheduled'),
          h('div', { class: 'prose' }, h('p', null, 'New cards start with short steps (1 minute, then 10 minutes). Once you know a card, it comes back after a day, then the gap grows each time you remember it: roughly 2.5 times longer with Good, a little less with Hard, more with Easy.'), h('p', null, 'If you forget a card, it goes back to short steps and returns at about 40% of its old gap. Cards from different decks are mixed together and new cards are woven in among reviews, which helps you tell similar words apart.'), h('p', null, 'In multiple choice, a quick correct answer counts as Good, a slow one as Hard, and a wrong one as Again. Multiple choice never counts as Easy, because picking from a list is easier than recalling from scratch.')),
        ),
        h('details', null, h('summary', null, 'Why Learn and Practice work better than flipping'), h('div', { class: 'prose' }, h('p', null, 'Seeing a word and nodding is recognition, which fades fast. Typing it from its meaning, choosing it for a blank and writing your own sentence are recall, which builds memory. Learn does all three within minutes of meeting a word, and the schedule then brings it back at growing gaps.'))),
        h('details', null, h('summary', null, 'Using it on the Tube'), h('div', { class: 'prose' }, h('p', null, 'Add it to your Home Screen from Safari (Share, then Add to Home Screen). After one visit with a connection, flashcards, multiple choice, Learn and the practice drills all work offline, and your answers sync when you are back online.'), h('p', null, 'The pronunciation button uses your phone’s own voice, so it works offline too.'))),
        h('p', { class: 'dim' }, 'TubeCards 1.0'),
      ),
    );
  }

  render();
  return { update() {}, destroy() {} };
}
