// Study tab: learn new words, then review what is due.

import { h, clear, icon, segmented, toast } from '../ui.js';
import * as store from '../store.js';
import { dueCounts, buildQueue, shuffle, MIN, addDays, daysBetween } from '../srs.js';
import { streak } from '../stats.js';
import { unlockSpeech } from '../speech.js';
import { runSession } from './session.js';
import { runLearn } from './learn.js';
import { openCardEditor } from './editor.js';
import { openImport } from './import.js';

const prefs = { reverse: false };

export function mount(el) {
  let busy = false;
  const exit = () => {
    busy = false;
    render();
  };

  const newCards = () => store.cardList().filter((c) => !c.suspended && (c.srs?.state || 'new') === 'new');

  function startLearn() {
    const pool = newCards();
    if (!pool.length) return toast('No new words left. Import more in Cards.');
    const n = store.state.settings.learnBatch || 5;
    const batch = shuffle(pool.slice()).slice(0, n);
    unlockSpeech();
    busy = true;
    runLearn({ cards: batch, onExit: exit, more: { count: () => Math.min(n, newCards().length), start: startLearn } });
  }

  function startReview(ids) {
    if (!ids.length) return toast('Nothing due.');
    unlockSpeech();
    busy = true;
    const size = store.state.settings.sessionSize;
    runSession({
      ids,
      scheduled: true,
      style: store.state.settings.quizStyle,
      reverse: prefs.reverse,
      title: 'Review',
      buildMore: () => buildQueue(store.cardList(), Date.now(), { newPerDay: () => 0, learnAheadMs: 20 * MIN, size }),
      onExit: exit,
    });
  }

  function nextDueText(cards, now) {
    const eod = addDays(now, 1);
    let min = Infinity;
    for (const c of cards) if (!c.suspended && c.srs?.state === 'review' && c.srs.due >= eod) min = Math.min(min, c.srs.due);
    if (min === Infinity) return '';
    const d = daysBetween(now, min);
    return d === 1 ? 'Your next words are due tomorrow.' : `Your next words are due in ${d} days.`;
  }

  function render() {
    clear(el);
    const now = Date.now();
    const cards = store.cardList();
    const view = h('div', { class: 'view' });
    el.append(view);

    const s = streak(store.visibleDays(), now);
    view.append(h('div', { class: 'view-head' }, h('h1', null, 'Study'), s > 0 ? h('span', { class: 'streak', title: `${s} day streak` }, icon('flame', 18), `${s} ${s === 1 ? 'day' : 'days'}`) : null));

    if (!cards.length) {
      view.append(
        h(
          'section',
          { class: 'panel empty' },
          h('h2', null, 'No words yet'),
          h('p', null, 'Import a word list, add your own, or load a small sample to try the app.'),
          h('div', { class: 'row wrap' }, h('button', { class: 'btn primary', onclick: () => openImport({}) }, 'Import words'), h('button', { class: 'btn ghost', onclick: () => openCardEditor({}) }, 'Add a word'), h('button', { class: 'btn ghost', onclick: () => { const r = store.loadSample(); toast(`Loaded ${r.added} sample words`); } }, 'Load sample')),
        ),
      );
      return;
    }

    // Learn
    const fresh = newCards().length;
    const n = Math.min(store.state.settings.learnBatch || 5, fresh);
    view.append(
      h(
        'section',
        { class: 'panel learn-panel' },
        h('h2', null, 'Learn new words'),
        h('p', { class: 'dim' }, fresh ? `${fresh} not met yet. You will see ${n}, match them, use them in a blank, type them from memory, then write your own sentence.` : 'You have met every word. Import more in Cards.'),
        h('button', { class: 'btn primary big', disabled: !fresh, onclick: startLearn }, fresh ? `Learn ${n} new ${n === 1 ? 'word' : 'words'}` : 'No new words'),
      ),
    );

    // Review
    const counts = dueCounts(cards, now, { newPerDay: () => 0, learnAheadMs: 20 * MIN });
    const size = store.state.settings.sessionSize;
    const toStudy = Math.min(counts.total, size);
    view.append(
      h(
        'section',
        { class: 'panel hero' },
        counts.total > 0
          ? [h('div', { class: 'hero-num' }, String(counts.total)), h('div', { class: 'hero-label' }, counts.total === 1 ? 'word to review' : 'words to review'), h('div', { class: 'counts' }, h('span', null, h('b', null, counts.review), ' due'), h('span', null, h('b', null, counts.learning), ' in learning'))]
          : [h('div', { class: 'hero-label big' }, 'All caught up'), h('p', { class: 'dim' }, nextDueText(cards, now) || 'Learn some new words or try Practice.')],
      ),
      h('div', { class: 'stack' }, h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Review style'), segmented({ label: 'Review style', value: store.state.settings.quizStyle, options: [{ value: 'flip', label: 'Flip' }, { value: 'mcq', label: 'Choose' }, { value: 'mixed', label: 'Mixed' }], onChange: (v) => store.saveSettings({ quizStyle: v }) })), h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: prefs.reverse, onchange: (e) => (prefs.reverse = e.target.checked) }), h('span', null, 'Reverse: see the meaning first, recall the word'))),
      h('button', { class: 'btn primary big', disabled: counts.total === 0, onclick: () => startReview(buildQueue(cards, Date.now(), { newPerDay: () => 0, learnAheadMs: 20 * MIN, size })) }, counts.total === 0 ? 'Nothing due' : `Review ${toStudy} ${toStudy === 1 ? 'word' : 'words'}`),
    );
  }

  render();
  return {
    update(kinds) {
      if (busy) return;
      if (kinds.some((k) => ['cards', 'decks', 'days', 'ready'].includes(k))) render();
    },
    destroy() {},
  };
}
