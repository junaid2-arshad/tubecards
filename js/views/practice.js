// Practice tab: drills that use your words, plus a pointer to official GRE material.

import { h, clear, toast } from '../ui.js';
import * as store from '../store.js';
import { isoWeek, addDays, buildPractice } from '../srs.js';
import { weaknessScore } from '../srs.js';
import { QUESTIONS } from '../questions.js';
import { runSession } from './session.js';
import { runCloze, runWrite, runQuestions, unseenQuestionCount } from './drills.js';
import { makeCloze } from '../practice.js';

const met = (c) => !c.suspended && c.srs?.state && c.srs.state !== 'new';

export function mount(el) {
  let busy = false;

  const exit = () => {
    busy = false;
    render();
  };

  // flip-card practice on a set of card ids (never changes the schedule)
  function review(ids, title = 'Review') {
    if (!ids.length) return toast('Nothing to review.');
    busy = true;
    runSession({ ids, scheduled: false, style: store.state.settings.quizStyle, reverse: false, title, buildMore: () => [], onExit: exit });
  }
  const launch = (fn) => () => {
    busy = true;
    fn();
  };

  function row(title, sub, count, onclick, unit) {
    return h('button', { class: 'row-btn', disabled: !count, onclick }, h('span', { class: 'row-main' }, h('strong', null, title), h('span', { class: 'dim' }, sub)), h('span', { class: 'row-count' }, count ? String(count) : '0', unit ? h('span', { class: 'row-unit' }, ' ' + unit) : null));
  }

  function render() {
    clear(el);
    const now = Date.now();
    const cards = store.cardList();
    const learned = cards.filter(met);
    const clozeReady = learned.filter((c) => c.hint && makeCloze(c, learned)).length;
    const week = isoWeek(now);
    const weakCount = cards.filter((c) => !c.suspended && weaknessScore(c) > 0).length;
    const weekCount = cards.filter((c) => !c.suspended && c.batch === week && c.srs?.state !== 'new').length;
    const aheadCount = cards.filter((c) => !c.suspended && c.srs?.state === 'review' && c.srs.due >= addDays(now, 1)).length;
    const unseen = unseenQuestionCount();

    const view = h('div', { class: 'view' });
    el.append(view);
    view.append(h('div', { class: 'view-head' }, h('h1', null, 'Practice')), h('p', { class: 'dim' }, 'Recognising a word is easy. These drills make you use it, which is what makes it stick.'));

    if (!learned.length) {
      view.append(h('section', { class: 'panel' }, h('h2', null, 'Learn a few words first'), h('p', null, 'The drills below use words you have already met. Go to Study and tap Learn new words.'), h('button', { class: 'btn primary', onclick: () => (location.hash = '#/study') }, 'Go to Study')));
    }

    view.append(
      h(
        'section',
        { class: 'stack' },
        h('h2', null, 'Use your words'),
        h(
          'div',
          { class: 'list' },
          row('Fill the blank', 'Pick the word that completes your example sentence', clozeReady, launch(() => runCloze({ onExit: exit, onReview: (ids) => review(ids, 'Missed words') })), 'words'),
          row('Write a sentence', 'Make your own sentence with a word, then compare', learned.length, launch(() => runWrite({ onExit: exit })), 'words'),
        ),
      ),
      h(
        'section',
        { class: 'stack' },
        h('h2', null, 'GRE-style questions'),
        h('p', { class: 'dim' }, `${QUESTIONS.length} original text completion and sentence equivalence questions written for this app. They are not official ETS questions.`),
        h('div', { class: 'list' }, row('Question set', unseen ? `${unseen} you have not tried yet` : 'Starts with the ones you missed', QUESTIONS.length, launch(() => runQuestions({ onExit: exit, onReview: (ids) => review(ids, 'Words from missed questions') })), 'questions')),
      ),
      h(
        'section',
        { class: 'stack' },
        h('h2', null, 'Review'),
        h(
          'div',
          { class: 'list' },
          row('Weak words', 'The ones you forget most', weakCount, () => review(buildPractice(cards, { kind: 'weak', size: 20 }), 'Weak words'), 'words'),
          row('This week’s words', `Words from ${week} you have already met`, weekCount, () => review(buildPractice(cards.filter((c) => c.batch === week && c.srs?.state !== 'new'), { kind: 'all', size: 40 }), 'This week'), 'words'),
          row('Study ahead', 'Words that are not due yet, soonest first', aheadCount, () => review(buildPractice(cards, { kind: 'ahead', size: 20 }), 'Study ahead'), 'words'),
        ),
      ),
      h(
        'section',
        { class: 'panel stack' },
        h('h2', null, 'Official GRE questions'),
        h('p', null, 'ETS, who write the GRE, offer free POWERPREP Online practice tests, and sell the Official Guide and verbal practice books. Their questions are copyrighted, so they cannot be added to this app. Use them for full-length practice, and use this app to learn the vocabulary they test.'),
        h('a', { class: 'btn ghost', href: 'https://www.ets.org/gre/test-takers/general-test/prepare.html', target: '_blank', rel: 'noopener' }, 'ETS GRE preparation page'),
      ),
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
