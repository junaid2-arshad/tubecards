// Study tab: what is due today, how to quiz, and practice shortcuts.

import { h, clear, icon, segmented, deckDot, toast } from '../ui.js';
import * as store from '../store.js';
import { dueCounts, buildQueue, buildPractice, weaknessScore, isoWeek, MIN, addDays, startOfDay, daysBetween } from '../srs.js';
import { streak } from '../stats.js';
import { unlockSpeech } from '../speech.js';
import { runSession } from './session.js';
import { openCardEditor } from './editor.js';
import { openImport } from './import.js';

// Remembered while the app is open.
const prefs = { scope: 'all', reverse: false };

export function mount(el, ctx) {
  let inSession = false;

  function scopeOpts() {
    const o = { newPerDay: store.deckNewLimit, learnAheadMs: 20 * MIN };
    if (prefs.scope === 'week') o.batch = isoWeek(Date.now());
    else if (prefs.scope !== 'all' && store.state.decks.has(prefs.scope)) o.deckIds = new Set([prefs.scope]);
    else prefs.scope = 'all';
    return o;
  }

  function start(ids, scheduled, title) {
    if (!ids.length) return toast('Nothing to study here yet.');
    unlockSpeech();
    inSession = true;
    runSession({
      ids,
      scheduled,
      style: store.state.settings.quizStyle,
      reverse: prefs.reverse,
      title,
      buildMore: scheduled ? () => buildQueue(store.cardList(), Date.now(), { ...scopeOpts(), size: store.state.settings.sessionSize }) : () => [],
      onExit: () => {
        inSession = false;
        render();
      },
    });
  }

  function nextDueText(cards, now) {
    const eod = addDays(now, 1);
    let min = Infinity;
    for (const c of cards) if (!c.suspended && c.srs?.state === 'review' && c.srs.due >= eod) min = Math.min(min, c.srs.due);
    if (min === Infinity) return '';
    const d = daysBetween(now, min);
    return d === 1 ? 'Your next cards are due tomorrow.' : `Your next cards are due in ${d} days.`;
  }

  function render() {
    clear(el);
    const now = Date.now();
    const cards = store.cardList();
    const decks = store.deckList();
    const view = h('div', { class: 'view' });
    el.append(view);

    const days = store.state.days;
    const s = streak(days, now);
    view.append(
      h(
        'div',
        { class: 'view-head' },
        h('h1', null, 'Study'),
        s > 0 ? h('span', { class: 'streak', title: `${s} day streak` }, icon('flame', 18), `${s} ${s === 1 ? 'day' : 'days'}`) : null,
      ),
    );

    if (!cards.length) {
      view.append(
        h(
          'section',
          { class: 'panel empty' },
          h('h2', null, 'No cards yet'),
          h('p', null, 'Add your first cards, import this week’s list, or load the sample set to try the app.'),
          h('div', { class: 'row wrap' }, h('button', { class: 'btn primary', onclick: () => openCardEditor({}) }, 'Add a card'), h('button', { class: 'btn ghost', onclick: () => openImport({}) }, 'Import cards'), h('button', { class: 'btn ghost', onclick: () => { const r = store.loadSample(); toast(`Loaded ${r.added} sample cards`); } }, 'Load sample cards')),
        ),
      );
      return;
    }

    // scope chips
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'What to study' });
    const addChip = (value, label, kind) =>
      chips.append(
        h('button', { class: 'chip' + (prefs.scope === value ? ' on' : ''), 'aria-pressed': String(prefs.scope === value), onclick: () => { prefs.scope = value; render(); } }, kind ? deckDot(kind) : null, label),
      );
    addChip('all', 'Everything');
    for (const d of decks) addChip(d.id, d.name, d.kind);
    addChip('week', 'Added this week');
    view.append(chips);

    const opts = scopeOpts();
    const counts = dueCounts(cards, now, opts);
    const size = store.state.settings.sessionSize;
    const toStudy = Math.min(counts.total, size);

    view.append(
      h(
        'section',
        { class: 'panel hero' },
        counts.total > 0
          ? [
              h('div', { class: 'hero-num' }, String(counts.total)),
              h('div', { class: 'hero-label' }, counts.total === 1 ? 'card ready' : 'cards ready'),
              h('div', { class: 'counts' }, h('span', null, h('b', null, counts.new), ' new'), h('span', null, h('b', null, counts.review), ' to review'), h('span', null, h('b', null, counts.learning), ' in learning')),
            ]
          : [h('div', { class: 'hero-label big' }, 'All caught up'), h('p', { class: 'dim' }, nextDueText(cards, now) || 'Add more cards or practise what you know.')],
      ),
    );

    view.append(
      h(
        'div',
        { class: 'stack' },
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Quiz style'), segmented({ label: 'Quiz style', value: store.state.settings.quizStyle, options: [{ value: 'flip', label: 'Flip' }, { value: 'mcq', label: 'Choose' }, { value: 'mixed', label: 'Mixed' }], onChange: (v) => store.saveSettings({ quizStyle: v }) })),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: prefs.reverse, onchange: (e) => (prefs.reverse = e.target.checked) }), h('span', null, 'Reverse: see the meaning or English first')),
        h('p', { class: 'field-help' }, 'New cards are always shown first so you can see the answer. Multiple choice starts once a card has been introduced.'),
      ),
    );

    view.append(
      h('button', { class: 'btn primary big', disabled: counts.total === 0, onclick: () => start(buildQueue(cards, Date.now(), { ...scopeOpts(), size }), true, 'Study session') }, counts.total === 0 ? 'Nothing due' : `Start ${toStudy} ${toStudy === 1 ? 'card' : 'cards'}`),
    );

    // practice
    const week = isoWeek(now);
    const weakCount = cards.filter((c) => !c.suspended && weaknessScore(c) > 0).length;
    const weekCount = cards.filter((c) => !c.suspended && c.batch === week).length;
    const aheadCount = cards.filter((c) => !c.suspended && c.srs?.state === 'review' && c.srs.due >= addDays(now, 1)).length;
    const scopeNoBatch = { ...scopeOpts() };
    view.append(
      h(
        'section',
        { class: 'stack' },
        h('h2', null, 'Extra practice'),
        h('p', { class: 'dim' }, 'Practice never changes when cards come back, but every answer is still tracked.'),
        h(
          'div',
          { class: 'list' },
          practiceRow('Weak cards', 'The ones you forget most', weakCount, () => start(buildPractice(cards, { ...scopeNoBatch, kind: 'weak', size: 20 }), false, 'Weak cards')),
          practiceRow('This week’s cards', `Everything added in ${week}`, weekCount, () => start(buildPractice(cards, { ...scopeNoBatch, batch: week, kind: 'all', size: 40 }), false, 'This week')),
          practiceRow('Study ahead', 'Cards not due yet, soonest first', aheadCount, () => start(buildPractice(cards, { ...scopeNoBatch, kind: 'ahead', size: 20 }), false, 'Study ahead')),
        ),
      ),
    );
  }

  function practiceRow(title, sub, count, onclick) {
    return h('button', { class: 'row-btn', disabled: count === 0, onclick }, h('span', { class: 'row-main' }, h('strong', null, title), h('span', { class: 'dim' }, sub)), h('span', { class: 'row-count' }, String(count)));
  }

  render();
  return {
    update(kinds) {
      if (inSession) return;
      if (kinds.some((k) => ['cards', 'decks', 'days', 'ready'].includes(k))) render();
    },
    destroy() {},
  };
}
