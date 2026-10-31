// Practice drills that use your words in context. They never change the review schedule;
// every answer is still logged so Stats can show how you are doing.

import { h } from '../ui.js';
import * as store from '../store.js';
import { makeCloze, drillOrder } from '../practice.js';
import { QUESTIONS, pickQuestions } from '../questions.js';
import { allEntries } from '../stats.js';
import { openOverlay } from './overlay.js';
import { clozeStep, writeStep, questionStep } from './steps.js';

const met = (c) => !c.suspended && c.srs?.state && c.srs.state !== 'new';

function summaryScreen(ov, { title, line, sub, missed = [], actions }) {
  ov.setProgress(1, 'Done');
  ov.reset();
  ov.stage.append(
    h('div', { class: 'summary' }, h('h2', null, title), h('p', { class: 'summary-big' }, line), sub ? h('p', { class: 'dim' }, sub) : null, missed.length ? h('div', { class: 'stack' }, h('h3', null, 'Worth another look'), h('ul', { class: 'plain-list' }, missed.map((c) => h('li', null, h('strong', null, c.front), ' ', h('span', { class: 'dim' }, c.back))))) : null),
  );
  ov.controls.append(...actions.filter(Boolean));
}

// ---------- Fill the blank, using your own example sentences ----------
export function runCloze({ onExit, onReview, size = 10 }) {
  const pool = store.cardList().filter(met);
  const ordered = drillOrder(pool.filter((c) => c.hint));
  const ov = openOverlay({ title: 'Fill the blank', onExit });
  const items = [];
  for (const c of ordered) {
    if (items.length >= size) break;
    const q = makeCloze(c, pool);
    if (q) items.push(q);
  }
  const missed = [];
  let right = 0;
  const go = (i) => {
    if (ov.closed) return;
    if (i >= items.length) {
      return summaryScreen(ov, {
        title: 'Round finished',
        line: `${right} of ${items.length} correct`,
        sub: missed.length ? 'The words you missed are listed below.' : 'Clean sweep.',
        missed,
        actions: [
          missed.length && onReview ? h('button', { class: 'btn primary big', onclick: () => { ov.close(); onReview(missed.map((c) => c.id)); } }, `Review ${missed.length} missed ${missed.length === 1 ? 'word' : 'words'}`) : null,
          h('button', { class: missed.length ? 'btn ghost big' : 'btn primary big', onclick: () => ov.close() }, 'Done'),
        ],
      });
    }
    const q = items[i];
    ov.setProgress(i / items.length, `Question ${i + 1} of ${items.length}`);
    const started = performance.now();
    clozeStep({
      stage: ov.stage,
      controls: ov.controls,
      q,
      onAnswered: ({ correct, chosen }) => {
        if (correct) right++;
        else missed.push(q.card);
        store.logPractice({ card: q.card, m: 'c', g: correct ? 3 : 1, ms: performance.now() - started, wrongId: correct ? undefined : chosen.id });
      },
      onNext: () => go(i + 1),
    });
  };
  if (!items.length) {
    summaryScreen(ov, { title: 'Nothing to practise yet', line: 'Learn a few words first', sub: 'This drill uses the example sentences of words you have already met.', actions: [h('button', { class: 'btn primary big', onclick: () => ov.close() }, 'Back')] });
  } else go(0);
  return ov;
}

// ---------- Write your own sentences ----------
export function runWrite({ onExit, size = 5 }) {
  const pool = store.cardList().filter(met);
  const words = drillOrder(pool).slice(0, size);
  const ov = openOverlay({ title: 'Use it', onExit });
  let good = 0;
  let wrote = 0;
  const go = (i) => {
    if (ov.closed) return;
    if (i >= words.length) {
      return summaryScreen(ov, {
        title: 'Nicely done',
        line: wrote ? `${wrote} ${wrote === 1 ? 'sentence' : 'sentences'} written` : 'No sentences written',
        sub: wrote ? `${good} felt clear. Sentences you write are saved on each card, in the card editor.` : 'Try again when you have a minute. Writing is the quickest way to make a word yours.',
        actions: [h('button', { class: 'btn primary big', onclick: () => ov.close() }, 'Done')],
      });
    }
    ov.setProgress(i / words.length, `Word ${i + 1} of ${words.length}`);
    const card = store.state.cards.get(words[i].id) || words[i];
    writeStep({
      stage: ov.stage,
      controls: ov.controls,
      card,
      onDone: ({ sentence, understood }) => {
        if (sentence) {
          wrote++;
          if (understood) good++;
          store.logPractice({ card, m: 'w', g: understood ? 3 : 1 });
        }
        go(i + 1);
      },
    });
  };
  if (!words.length) {
    summaryScreen(ov, { title: 'Nothing to practise yet', line: 'Learn a few words first', actions: [h('button', { class: 'btn primary big', onclick: () => ov.close() }, 'Back')] });
  } else go(0);
  return ov;
}

// ---------- GRE-style questions ----------
export function questionHistory() {
  const hist = new Map();
  for (const e of allEntries(store.visibleDays())) {
    if (e.m !== 't' || !e.q) continue;
    const h0 = hist.get(e.q) || { seen: 0, wrong: 0 };
    h0.seen++;
    if (e.g < 2) h0.wrong++;
    hist.set(e.q, h0);
  }
  return hist;
}

export function unseenQuestionCount() {
  const hist = questionHistory();
  return QUESTIONS.filter((q) => !hist.has(q.id)).length;
}

export function runQuestions({ onExit, onReview, size = 8 }) {
  const picked = pickQuestions(QUESTIONS, questionHistory(), size);
  const ov = openOverlay({ title: 'GRE-style questions', onExit });
  const byFront = new Map(store.cardList().map((c) => [c.front, c]));
  const wrongWords = new Set();
  let right = 0;
  const go = (i) => {
    if (ov.closed) return;
    if (i >= picked.length) {
      const cards = [...wrongWords].map((w) => byFront.get(w)).filter(Boolean);
      return summaryScreen(ov, {
        title: 'Set finished',
        line: `${right} of ${picked.length} correct`,
        sub: cards.length ? 'These words appeared in the questions you missed.' : 'No misses. Try another set.',
        missed: cards,
        actions: [
          cards.length && onReview ? h('button', { class: 'btn primary big', onclick: () => { ov.close(); onReview(cards.map((c) => c.id)); } }, `Review ${cards.length} ${cards.length === 1 ? 'word' : 'words'}`) : null,
          h('button', { class: cards.length ? 'btn ghost big' : 'btn primary big', onclick: () => ov.close() }, 'Done'),
        ],
      });
    }
    const q = picked[i];
    ov.setProgress(i / picked.length, `Question ${i + 1} of ${picked.length}`);
    const started = performance.now();
    questionStep({
      stage: ov.stage,
      controls: ov.controls,
      q,
      wordCards: byFront,
      index: i,
      total: picked.length,
      onAnswered: ({ correct }) => {
        if (correct) right++;
        else for (const w of q.words) wrongWords.add(w);
        store.logPractice({ card: null, m: 't', g: correct ? 3 : 1, ms: performance.now() - started, q: q.id });
      },
      onNext: () => go(i + 1),
    });
  };
  go(0);
  return ov;
}
