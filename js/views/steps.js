// Single-screen activities. Each draws into `stage` and `controls` (from an overlay) and calls back when done.
// The caller decides what comes next, so the same screens serve the guided Learn flow and the Practice drills.

import { h, clear, icon, toast } from '../ui.js';
import * as store from '../store.js';
import { shuffle } from '../srs.js';
import { checkTyped, letterHint, checkSentence, SENTENCE_MESSAGES, feedbackPrompt, findWord } from '../practice.js';
import { stemParts, TYPE_LABEL, isCorrect } from '../questions.js';
import { speakText, autoSpeak } from './audio.js';
import { speakBtn } from './face.js';

const reset = (stage, controls) => {
  clear(stage);
  clear(controls);
  stage.scrollTop = 0;
};
const btn = (label, onclick, cls = 'btn primary big') => h('button', { type: 'button', class: cls, onclick }, label);
const deckName = (card) => store.state.decks.get(card.deckId)?.name || '';

function wordHeader(card, { showMeaning = true } = {}) {
  return h('div', { class: 'face kind-gre' }, h('div', { class: 'face-top' }, h('span', { class: 'face-deck' }, deckName(card))), h('div', { class: 'face-main-row' }, h('div', { class: 'face-main' }, card.front), speakBtn(card.front, speakText, 'Hear the word')), showMeaning ? h('p', { class: 'face-sub' }, card.back) : null);
}

// ---------- Meet: see the word fully, add a memory hook ----------
export function meetStep({ stage, controls, card, onNext }) {
  reset(stage, controls);
  autoSpeak(card.front);
  const hook = h('textarea', { class: 'input', rows: 2, value: card.hook || '', placeholder: 'A picture, story or sound-alike that makes it stick', 'aria-label': 'Memory hook' });
  const sentence = card.hint ? findAndMark(card) : null;
  const face = h(
    'div',
    { class: 'face kind-gre' },
    h('div', { class: 'face-top' }, h('span', { class: 'face-deck' }, deckName(card))),
    h('div', { class: 'face-main-row' }, h('div', { class: 'face-main' }, card.front), speakBtn(card.front, speakText, 'Hear the word')),
    h('p', { class: 'meet-meaning' }, card.back),
    sentence ? h('div', { class: 'face-sub-row' }, h('p', { class: 'face-sub' }, sentence), speakBtn(card.hint, speakText, 'Hear the sentence')) : null,
    card.notes ? h('p', { class: 'face-notes' }, card.notes) : null,
  );
  stage.append(face, h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Your memory hook (optional)'), hook));
  const next = (known) => {
    const v = hook.value.trim();
    if (v !== (card.hook || '')) store.updateCard(card.id, { hook: v });
    onNext(known);
  };
  controls.append(btn('Next word', () => next(false)), btn('I already know this word', () => next(true), 'btn ghost'));
}

function findAndMark(card) {
  const hit = findWord(card.hint, card.front);
  if (!hit) return card.hint;
  return [card.hint.slice(0, hit.start), h('mark', null, card.hint.slice(hit.start, hit.end)), card.hint.slice(hit.end)];
}

// ---------- Match words to meanings ----------
// onDone(missedIds: Set)
export function matchStep({ stage, controls, cards, onDone }) {
  reset(stage, controls);
  const missed = new Set();
  let matched = 0;
  const sel = { word: null, meaning: null };
  stage.append(h('p', { class: 'step-prompt' }, 'Tap a word, then its meaning.'));
  const grid = h('div', { class: 'match-grid' });
  const mk = (side, card, text) => {
    const b = h('button', { type: 'button', class: `match-item ${side}`, 'data-id': card.id, onclick: () => pick(side, card, b) }, text);
    return b;
  };
  const words = shuffle(cards).map((c) => mk('word', c, c.front));
  const meanings = shuffle(cards).map((c) => mk('meaning', c, c.back));
  grid.append(h('div', { class: 'match-col' }, words), h('div', { class: 'match-col' }, meanings));
  stage.append(grid);

  function pick(side, card, el) {
    if (el.classList.contains('done')) return;
    const other = side === 'word' ? 'meaning' : 'word';
    if (sel[side]?.el === el) {
      el.classList.remove('sel');
      sel[side] = null;
      return;
    }
    sel[side]?.el.classList.remove('sel');
    sel[side] = { card, el };
    el.classList.add('sel');
    if (side === 'word') speakText(card.front);
    if (!sel[other]) return;
    const a = sel.word;
    const b = sel.meaning;
    sel.word = sel.meaning = null;
    if (a.card.id === b.card.id) {
      for (const x of [a.el, b.el]) {
        x.classList.remove('sel');
        x.classList.add('done');
        x.disabled = true;
      }
      matched++;
      if (matched === cards.length) {
        controls.append(btn('Continue', () => onDone(missed)));
        controls.querySelector('button')?.focus({ preventScroll: true });
      }
    } else {
      missed.add(a.card.id);
      missed.add(b.card.id);
      for (const x of [a.el, b.el]) x.classList.add('bad');
      setTimeout(() => {
        for (const x of [a.el, b.el]) x.classList.remove('bad', 'sel');
      }, 600);
    }
  }
}

// ---------- Fill the blank ----------
// q comes from makeCloze(). onAnswered({correct, chosen}) fires once. onNext() when the person moves on.
export function clozeStep({ stage, controls, q, onAnswered, onNext, autoAdvanceMs = 1500 }) {
  reset(stage, controls);
  stage.append(h('p', { class: 'step-prompt' }, 'Which word completes the sentence? Any ending is fine.'));
  const sentence = h('p', { class: 'cloze-sentence' }, q.before, h('span', { class: 'blank' }, '        '), q.after);
  stage.append(h('div', { class: 'face kind-gre' }, sentence));
  const list = h('div', { class: 'options', role: 'group', 'aria-label': 'Choose the word' });
  let answered = false;
  let timer = null;
  q.options.forEach((o, i) => {
    list.append(h('button', { type: 'button', class: 'option', 'data-id': o.id, onclick: () => choose(o) }, h('span', { class: 'option-key' }, String(i + 1)), h('span', { class: 'option-text' }, o.text), h('span', { class: 'option-mark', 'aria-hidden': 'true' })));
  });
  controls.append(list);

  function choose(o) {
    if (answered) return;
    answered = true;
    for (const b of list.querySelectorAll('.option')) {
      b.disabled = true;
      const opt = q.options.find((x) => x.id === b.dataset.id);
      const mark = b.querySelector('.option-mark');
      if (opt.correct) {
        b.classList.add('right');
        mark.append(icon('check', 20));
      } else if (opt === o) {
        b.classList.add('wrong');
        mark.append(icon('x', 20));
      }
    }
    const right = q.options.find((x) => x.correct);
    clear(sentence);
    sentence.append(q.before, h('mark', null, q.token), q.after);
    stage.append(h('p', { class: 'reveal-line' }, h('strong', null, right.text), ' means ', right.meaning));
    if (!o.correct) stage.append(h('p', { class: 'reveal-line dim' }, h('strong', null, o.text), ' means ', o.meaning, '.'));
    speakText(right.text);
    onAnswered({ correct: !!o.correct, chosen: o });
    const go = h('button', { type: 'button', class: 'btn primary big', onclick: () => { clearTimeout(timer); onNext(); } }, 'Next');
    controls.append(go);
    go.focus({ preventScroll: true });
    if (o.correct && autoAdvanceMs) timer = setTimeout(onNext, autoAdvanceMs);
  }
}

// ---------- Type the word from its meaning ----------
// onResult({ result: 'exact'|'close'|'wrong', hintUsed }) fires once, onNext() to continue.
export function recallStep({ stage, controls, card, attempt = 1, onResult, onNext }) {
  reset(stage, controls);
  let hintUsed = false;
  let done = false;
  stage.append(
    h('p', { class: 'step-prompt' }, attempt > 1 ? 'Once more. Which word means:' : 'Which word means:'),
    h('div', { class: 'face kind-gre' }, h('div', { class: 'face-main answer' }, card.back)),
  );
  const hintLine = h('p', { class: 'hint-line', 'aria-live': 'polite' });
  const input = h('input', { class: 'input big-input', type: 'text', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'done', placeholder: 'Type the word', 'aria-label': 'Your answer' });
  const msg = h('div', { class: 'feedback', 'aria-live': 'polite' });
  stage.append(input, hintLine, msg);

  const check = () => {
    if (done) return;
    const result = checkTyped(card.front, input.value);
    if (result === 'empty') {
      input.focus();
      return;
    }
    finish(result);
  };
  const giveUp = () => {
    if (!done) finish('wrong', true);
  };
  const hintBtn = h('button', { type: 'button', class: 'btn ghost', onclick: () => { hintUsed = true; hintLine.textContent = letterHint(card.front); hintBtn.disabled = true; input.focus(); } }, 'Show a hint');
  const checkBtn = h('button', { type: 'button', class: 'btn primary big', onclick: check }, 'Check');
  const skipBtn = h('button', { type: 'button', class: 'btn ghost', onclick: giveUp }, 'I do not know');
  controls.append(checkBtn, h('div', { class: 'row' }, hintBtn, skipBtn));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      check();
    }
  });
  setTimeout(() => input.focus({ preventScroll: true }), 60);

  function finish(result, gaveUp = false) {
    done = true;
    input.disabled = true;
    clear(controls);
    clear(msg);
    if (result === 'exact') msg.append(h('p', { class: 'ok-text' }, 'Right.'));
    else if (result === 'close') msg.append(h('p', { class: 'ok-text' }, 'Right. Check the spelling: ', h('strong', null, card.front)));
    else msg.append(h('p', { class: 'form-error' }, gaveUp ? 'The word is ' : 'Not quite. The word is ', h('strong', null, card.front), '.'));
    if (card.hook && result === 'wrong') msg.append(h('p', { class: 'dim' }, 'Your hook: ', card.hook));
    speakText(card.front);
    onResult({ result, hintUsed });
    const go = btn('Continue', onNext);
    controls.append(go);
    go.focus({ preventScroll: true });
  }
}

// ---------- Write your own sentence ----------
// onDone({ sentence|null, understood: bool|null }) fires when the person finishes or skips.
export function writeStep({ stage, controls, card, onDone }) {
  reset(stage, controls);
  stage.append(
    h('p', { class: 'step-prompt' }, 'Write your own sentence using this word.'),
    wordHeader(card),
    h('details', { class: 'example' }, h('summary', null, 'See an example'), h('p', { class: 'face-sub' }, card.hint || 'No example saved for this word.')),
  );
  const area = h('textarea', { class: 'input', rows: 3, placeholder: `Use “${card.front}” in a sentence about something real in your life`, autocapitalize: 'sentences', 'aria-label': 'Your sentence' });
  const msg = h('div', { class: 'feedback', 'aria-live': 'polite' });
  stage.append(area, msg);
  setTimeout(() => area.focus({ preventScroll: true }), 60);

  const submit = () => {
    const sentence = area.value.trim();
    const r = checkSentence(sentence, card);
    clear(msg);
    if (!r.ok) {
      msg.append(h('p', { class: 'form-error' }, SENTENCE_MESSAGES[r.reason]));
      area.focus();
      return;
    }
    // Keep the last five sentences on the card.
    const mine = [{ s: sentence, t: Date.now() }, ...(card.mine || [])].slice(0, 5);
    store.updateCard(card.id, { mine });
    area.disabled = true;
    clear(controls);
    msg.append(h('p', { class: 'ok-text' }, 'Saved. Compare it with the example:'), h('p', { class: 'face-sub' }, card.hint || card.back));
    msg.append(h('p', { class: 'step-prompt' }, 'Does your sentence make the meaning clear?'));
    controls.append(
      h('div', { class: 'grades two' }, btn('Not sure', () => onDone({ sentence, understood: false }), 'grade g1'), btn('Yes', () => onDone({ sentence, understood: true }), 'grade g3')),
      h('button', { type: 'button', class: 'btn ghost', onclick: async () => {
        try {
          await navigator.clipboard.writeText(feedbackPrompt(card, sentence));
          toast('Copied. Paste it into any AI chat for feedback.');
        } catch {
          toast('Could not copy on this device.');
        }
      } }, 'Copy for AI feedback'),
    );
  };
  controls.append(btn('Check my sentence', submit), btn('Skip this word', () => onDone({ sentence: null, understood: null }), 'btn ghost'));
}

// ---------- GRE-style question ----------
// onAnswered({ correct, selection }) fires once, onNext() to continue. wordCards: Map(front -> card) for meanings.
export function questionStep({ stage, controls, q, wordCards, onAnswered, onNext, index, total }) {
  reset(stage, controls);
  stage.append(h('p', { class: 'step-prompt' }, TYPE_LABEL[q.type]));
  const roman = ['(i)', '(ii)'];
  const parts = stemParts(q.stem);
  const stem = h('p', { class: 'q-stem' });
  for (const p of parts) {
    if (typeof p === 'number') stem.append(h('span', { class: 'blank', 'data-blank': p }, q.type === 'tc2' ? roman[p - 1] + ' ______' : '______'));
    else stem.append(p);
  }
  stage.append(h('div', { class: 'face kind-gre' }, stem));

  // each blank has its own shuffled option list; selection is stored as original indexes
  const selection = q.blanks.map(() => []);
  const need = q.type === 'se' ? 2 : 1;
  const groups = q.blanks.map((opts, bi) => {
    const order = shuffle(opts.map((_, i) => i));
    const wrap = h('div', { class: 'options', role: 'group', 'aria-label': q.type === 'tc2' ? `Blank ${roman[bi]}` : 'Choices' });
    if (q.type === 'tc2') wrap.append(h('p', { class: 'step-prompt' }, `Blank ${roman[bi]}`));
    for (const oi of order) {
      const b = h('button', { type: 'button', class: 'option', 'data-i': oi, 'aria-pressed': 'false', onclick: () => toggle(bi, oi, b) }, h('span', { class: 'option-text' }, opts[oi]), h('span', { class: 'option-mark', 'aria-hidden': 'true' }));
      wrap.append(b);
    }
    return wrap;
  });
  stage.append(...groups);
  const submit = h('button', { type: 'button', class: 'btn primary big', disabled: true, onclick: () => grade() }, 'Check answer');
  controls.append(submit);

  const ready = () => selection.every((s) => s.length === need);
  function toggle(bi, oi, el) {
    const s = selection[bi];
    const at = s.indexOf(oi);
    if (at >= 0) {
      s.splice(at, 1);
    } else if (need === 1) {
      s.length = 0;
      s.push(oi);
    } else if (s.length < need) {
      s.push(oi);
    } else {
      return;
    }
    for (const b of groups[bi].querySelectorAll('.option')) {
      const on = s.includes(Number(b.dataset.i));
      b.classList.toggle('picked', on);
      b.setAttribute('aria-pressed', String(on));
    }
    submit.disabled = !ready();
  }

  function grade() {
    const sel = q.type === 'se' ? selection[0] : selection.map((s) => s[0]);
    const correct = isCorrect(q, sel);
    // colour the options
    q.blanks.forEach((opts, bi) => {
      const rightSet = q.type === 'se' ? new Set(q.answer) : new Set([q.answer[bi]]);
      for (const b of groups[bi].querySelectorAll('.option')) {
        const i = Number(b.dataset.i);
        const mark = b.querySelector('.option-mark');
        b.disabled = true;
        if (rightSet.has(i)) {
          b.classList.add('right');
          mark.append(icon('check', 20));
        } else if (selection[bi].includes(i)) {
          b.classList.add('wrong');
          mark.append(icon('x', 20));
        }
      }
    });
    // fill the stem with the right answers
    q.blanks.forEach((opts, bi) => {
      const span = stem.querySelector(`[data-blank="${bi + 1}"]`);
      const words = q.type === 'se' ? q.answer.map((i) => opts[i]).join(' / ') : opts[q.answer[bi]];
      span.textContent = words;
      span.classList.add('filled');
    });
    stage.append(h('p', { class: correct ? 'ok-text' : 'form-error' }, correct ? 'Correct.' : 'Not quite.'), h('p', { class: 'why' }, q.why));
    const related = q.words.map((w) => wordCards.get(w)).filter(Boolean);
    if (related.length) stage.append(h('ul', { class: 'plain-list word-list' }, related.map((c) => h('li', null, h('strong', null, c.front), ' ', h('span', { class: 'dim' }, c.back)))));
    onAnswered({ correct, selection: sel });
    clear(controls);
    const go = btn(index + 1 >= total ? 'See results' : 'Next question', onNext);
    controls.append(go);
    go.focus({ preventScroll: true });
  }
}
