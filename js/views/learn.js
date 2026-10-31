// Guided Learn: take a small batch of new words and use each one straight away.
//
//   1. Meet      see the word, hear it, add a memory hook
//   2. Match     pair each word with its meaning
//   3. Blank     choose the word that completes its example sentence
//   4. Recall    type the word from its meaning (the hardest, and the one that builds memory)
//   5. Write     use the word in a sentence of your own
//
// Words are handed to the review schedule after step 4, based on whether you recalled each one first time.

import { h } from '../ui.js';
import * as store from '../store.js';
import { shuffle, schedule, configFor, GRADE } from '../srs.js';
import { makeCloze } from '../practice.js';
import { openOverlay } from './overlay.js';
import { meetStep, matchStep, clozeStep, recallStep, writeStep } from './steps.js';

// opts: { cards (new cards to learn), onExit(), more: { count(): number, start() } optional, to offer another round }
export function runLearn({ cards, onExit, more }) {
  const batch = cards.slice();
  const n = batch.length;
  const ov = openOverlay({ title: 'Learn new words', onExit });
  const info = new Map(batch.map((c) => [c.id, { known: false, first: null, attempts: 0, hint: false, start: performance.now() }]));
  const total = n + 1 + n + n + n; // meet, match, blank, recall, write
  let done = 0;
  const progress = (label) => ov.setProgress(done / total, label);
  const prefer = new Set(batch.map((c) => c.id));
  const others = () => store.cardList().filter((c) => !prefer.has(c.id) && c.srs?.state !== 'new');

  // ----- 1. meet -----
  const meet = (i) => {
    if (ov.closed) return;
    if (i >= n) return match();
    progress(`Meet the words · ${i + 1} of ${n}`);
    meetStep({ stage: ov.stage, controls: ov.controls, card: batch[i], onNext: (known) => { info.get(batch[i].id).known = known; done++; meet(i + 1); } });
  };

  // ----- 2. match -----
  const match = () => {
    progress('Match words and meanings');
    matchStep({
      stage: ov.stage,
      controls: ov.controls,
      cards: batch,
      onDone: (missed) => {
        for (const c of batch) store.logPractice({ card: c, m: 'm', g: missed.has(c.id) ? 1 : 3 });
        done++;
        blank(shuffle(batch.slice()), 0, new Set());
      },
    });
  };

  // ----- 3. fill the blank -----
  const blank = (queue, i, retried) => {
    if (ov.closed) return;
    const card = queue[i];
    if (!card) return recall(shuffle(batch.slice()), 0);
    const q = makeCloze(card, [...batch, ...others()], Math.random, { prefer });
    if (!q) {
      done++;
      return blank(queue, i + 1, retried);
    }
    progress(`Fill the blank · ${Math.min(i + 1, queue.length)} of ${queue.length}`);
    const started = performance.now();
    clozeStep({
      stage: ov.stage,
      controls: ov.controls,
      q,
      onAnswered: ({ correct, chosen }) => {
        store.logPractice({ card, m: 'c', g: correct ? 3 : 1, ms: performance.now() - started, wrongId: correct ? undefined : chosen.id });
        if (!correct && !retried.has(card.id)) {
          retried.add(card.id);
          queue.push(card);
        } else done++;
      },
      onNext: () => blank(queue, i + 1, retried),
    });
  };

  // ----- 4. recall -----
  const recall = (queue, i) => {
    if (ov.closed) return;
    const card = queue[i];
    if (!card) return schedulePhase();
    const st = info.get(card.id);
    st.attempts++;
    progress(`Type it from memory · ${Math.min(i + 1, queue.length)} of ${queue.length}`);
    recallStep({
      stage: ov.stage,
      controls: ov.controls,
      card,
      attempt: st.attempts,
      onResult: ({ result, hintUsed }) => {
        const ok = result === 'exact' || result === 'close';
        if (st.first === null) st.first = ok && !hintUsed;
        if (hintUsed) st.hint = true;
        if (!ok && st.attempts < 2) queue.push(card);
        else done++;
      },
      onNext: () => recall(queue, i + 1),
    });
  };

  // ----- hand the words to the review schedule -----
  const results = [];
  const schedulePhase = () => {
    const now = Date.now();
    const cfg = configFor(store.state.settings, 'gre', now);
    for (const c of batch) {
      const st = info.get(c.id);
      const firstTry = st.first === true;
      const g = firstTry ? (st.known ? GRADE.EASY : GRADE.GOOD) : GRADE.AGAIN;
      const after = schedule(c.srs, g, now, cfg);
      store.answerCard(c.id, after, { t: now, c: c.id, d: c.deckId, g, m: 'r', s: 1, ps: 'n', ms: Math.round(Math.min(performance.now() - st.start, 600000)) });
      results.push({ card: c, firstTry });
    }
    write(shuffle(batch.slice()), 0, 0);
  };

  // ----- 5. write -----
  const write = (queue, i, understood) => {
    if (ov.closed) return;
    const card = queue[i];
    if (!card) return summary(understood);
    progress(`Use it · ${i + 1} of ${queue.length}`);
    writeStep({
      stage: ov.stage,
      controls: ov.controls,
      card: store.state.cards.get(card.id) || card,
      onDone: ({ sentence, understood: ok }) => {
        if (sentence) store.logPractice({ card, m: 'w', g: ok ? 3 : 1 });
        done++;
        write(queue, i + 1, understood + (sentence && ok ? 1 : 0));
      },
    });
  };

  // ----- summary -----
  const summary = (wrote) => {
    ov.setProgress(1, 'Done');
    ov.reset();
    const firsts = results.filter((r) => r.firstTry).length;
    const missed = results.filter((r) => !r.firstTry);
    ov.stage.append(
      h(
        'div',
        { class: 'summary' },
        h('h2', null, `${n} ${n === 1 ? 'word' : 'words'} learned`),
        h('p', { class: 'summary-big' }, `${firsts} of ${n} recalled first time`),
        h('p', { class: 'dim' }, 'They will come back in Study later today, then tomorrow. Open Study again in a few minutes to give them a second look.'),
        missed.length ? h('div', { class: 'stack' }, h('h3', null, 'Needs another look'), h('ul', { class: 'plain-list' }, missed.map((r) => h('li', null, h('strong', null, r.card.front), ' ', h('span', { class: 'dim' }, r.card.back))))) : null,
      ),
    );
    const left = more?.count() || 0;
    ov.controls.append(
      left ? h('div', { class: 'grades two' }, h('button', { class: 'btn ghost big', onclick: () => ov.close() }, 'Done'), h('button', { class: 'btn primary big', onclick: () => { ov.close(); more.start(); } }, `Learn ${left} more`)) : h('button', { class: 'btn primary big', onclick: () => ov.close() }, 'Done'),
    );
  };

  meet(0);
  return ov;
}
