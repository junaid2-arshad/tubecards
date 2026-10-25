// The full-screen study session.
//
// Progress is drawn as a route: each card is a stop on a line, so you can see how far
// along the journey you are at a glance. Hollow stops are cards you got wrong.

import { h, icon, clear, toast, confirmDialog } from '../ui.js';
import * as store from '../store.js';
import { GRADE, schedule, previewLabels, configFor, requeueOffset, shuffle } from '../srs.js';
import { speak, stopSpeaking, loadVoices } from '../speech.js';
import { renderFace } from './face.js';
import { openCardEditor } from './editor.js';

const STATE_CODE = { new: 'n', learning: 'l', review: 'r' };
const norm = (s) => String(s).trim().toLowerCase();

// Build multiple-choice options, or null if the deck is too small / too similar.
export function buildOptions(card, reverse, rng = Math.random) {
  const answerOf = (c) => (reverse ? c.front : c.back);
  const correct = answerOf(card);
  const seen = new Set([norm(correct)]);
  const pool = store.cardList().filter((c) => c.id !== card.id && !c.suspended && c.kind === card.kind);
  const sameDeck = shuffle(pool.filter((c) => c.deckId === card.deckId), rng);
  const others = shuffle(pool.filter((c) => c.deckId !== card.deckId), rng);
  const picks = [];
  for (const c of [...sameDeck, ...others]) {
    const t = answerOf(c);
    if (!t || seen.has(norm(t))) continue;
    seen.add(norm(t));
    picks.push({ id: c.id, text: t });
    if (picks.length === 3) break;
  }
  if (picks.length < 3) return null;
  return shuffle([{ id: card.id, text: correct, correct: true }, ...picks], rng);
}

// opts: { ids, scheduled, style, reverse, title, buildMore() -> ids[], onExit() }
export function runSession(opts) {
  const { scheduled, reverse } = opts;
  const rng = Math.random;
  let queue = [...opts.ids];
  const initial = [...opts.ids];
  let missed = new Set();
  const stats = { n: 0, ok: 0, ms: 0 };
  const undoStack = [];
  let cardStart = 0;
  let phase = 'front';
  let current = null;
  let mcq = null;
  let autoTimer = null;
  let closed = false;

  // ---------- layout ----------
  const route = h('div', { class: 'route', role: 'img' });
  const meta = h('div', { class: 'session-meta', 'aria-live': 'polite' });
  const undoBtn = h('button', { class: 'icon-btn', 'aria-label': 'Undo last answer', disabled: true, onclick: () => undo() }, icon('undo'));
  const editBtn = h('button', { class: 'icon-btn', 'aria-label': 'Edit this card', onclick: () => editCurrent() }, icon('edit'));
  const closeBtn = h('button', { class: 'icon-btn', 'aria-label': 'End session', onclick: () => requestClose() }, icon('x'));
  const stage = h('main', { class: 'stage' });
  const controls = h('footer', { class: 'controls' });
  const root = h('div', { class: 'session', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || 'Study session' }, h('header', { class: 'session-head' }, closeBtn, h('div', { class: 'route-wrap' }, route, meta), undoBtn, editBtn), stage, controls);
  document.body.append(root);
  document.body.classList.add('in-session');
  loadVoices();

  // ---------- route line ----------
  function drawRoute() {
    clear(route);
    const remaining = new Set(queue);
    const n = initial.length;
    const doneCount = initial.filter((id) => !remaining.has(id)).length;
    const left = remaining.size;
    meta.textContent = left === 0 ? 'Arrived' : `${left} ${left === 1 ? 'stop' : 'stops'} to go`;
    route.setAttribute('aria-label', `${doneCount} of ${n} cards done`);
    if (n > 40) {
      route.append(h('div', { class: 'route-bar' }, h('div', { class: 'route-bar-fill', style: { width: `${(doneCount / n) * 100}%` } })));
      return;
    }
    const lastDone = Math.max(-1, ...initial.map((id, i) => (remaining.has(id) ? -1 : i)));
    const fill = n > 1 && lastDone > 0 ? (lastDone / (n - 1)) * 100 : 0;
    const dots = h('div', { class: 'route-dots', 'aria-hidden': 'true' }, h('span', { class: 'route-line' }, h('span', { class: 'route-line-fill', style: { width: `${fill}%` } })));
    initial.forEach((id) => {
      const isNow = queue[0] === id;
      const cls = isNow ? 'st-now' : remaining.has(id) ? 'st-todo' : missed.has(id) ? 'st-miss' : 'st-done';
      dots.append(h('span', { class: `stop ${cls}` }));
    });
    route.append(dots);
  }

  // ---------- helpers ----------
  const speakIt = async (text) => {
    await loadVoices();
    speak(text, { lang: 'it-IT', rate: store.state.settings.speechRate, voiceURI: store.state.settings.voiceURI });
  };
  const onSpeak = (t) => speakIt(t);
  const setUndo = () => (undoBtn.disabled = undoStack.length === 0);
  const cardsLeft = () => queue.filter((id) => store.state.cards.has(id));

  function requestClose() {
    if (stats.n === 0 || closed) return finish(true);
    confirmDialog({ title: 'End this session?', message: `You have answered ${stats.n} ${stats.n === 1 ? 'card' : 'cards'}. Your answers are already saved.`, confirmLabel: 'End session' }).then((ok) => ok && finish(true));
  }

  function finish(exit) {
    clearTimeout(autoTimer);
    stopSpeaking();
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('in-session');
    closed = true;
    root.remove();
    opts.onExit?.();
  }

  function editCurrent() {
    if (!current) return;
    clearTimeout(autoTimer);
    openCardEditor({
      cardId: current.id,
      onSaved: () => showCard(true),
      onDeleted: () => {
        queue = queue.filter((id) => id !== current.id);
        next();
      },
    });
  }

  // ---------- flow ----------
  function next() {
    clearTimeout(autoTimer);
    queue = cardsLeft();
    drawRoute();
    setUndo();
    if (!queue.length) return summary();
    showCard(false);
  }

  function pickMode(card) {
    const style = opts.style;
    if (style === 'flip') return 'f';
    const canQ = card.srs.state !== 'new' || !scheduled;
    if (!canQ) return 'f';
    if (style === 'mcq' || (style === 'mixed' && rng() < 0.5)) {
      const o = buildOptions(card, reverse, rng);
      if (o) {
        mcq = o;
        return 'q';
      }
    }
    return 'f';
  }

  let mode = 'f';
  function showCard(keepMode) {
    current = store.state.cards.get(queue[0]);
    if (!current) return next();
    if (!keepMode) {
      mcq = null;
      mode = pickMode(current);
      phase = 'front';
      cardStart = performance.now();
      if (current.kind === 'italian' && !reverse && store.state.settings.autoPlay) speakIt(current.front);
    }
    drawRoute();
    clear(stage);
    clear(controls);
    if (mode === 'q') return drawMcq();
    drawFlip();
  }

  // ----- flip mode -----
  function drawFlip() {
    const face = renderFace(current, phase, { reverse, onSpeak });
    face.addEventListener('click', () => phase === 'front' && reveal());
    stage.append(face);
    if (phase === 'front') {
      const b = h('button', { class: 'btn primary big', onclick: reveal }, 'Show answer');
      controls.append(b);
      b.focus({ preventScroll: true });
      return;
    }
    const now = Date.now();
    const cfg = configFor(store.state.settings, current.kind, now);
    if (scheduled) {
      const labels = previewLabels(current.srs, now, cfg);
      const btn = (g, name) =>
        h('button', { class: `grade g${g}`, onclick: () => grade(g, 'f'), 'aria-label': `${name}, next review in ${labels[g]}` }, h('span', { class: 'grade-name' }, name), h('span', { class: 'grade-when' }, labels[g]));
      controls.append(h('div', { class: 'grades' }, btn(1, 'Again'), btn(2, 'Hard'), btn(3, 'Good'), btn(4, 'Easy')));
    } else {
      controls.append(
        h('div', { class: 'grades two' }, h('button', { class: 'grade g1', onclick: () => grade(1, 'f') }, h('span', { class: 'grade-name' }, 'Missed it')), h('button', { class: 'grade g3', onclick: () => grade(3, 'f') }, h('span', { class: 'grade-name' }, 'Got it'))),
      );
    }
  }

  function reveal() {
    if (phase !== 'front') return;
    phase = 'back';
    if (current.kind === 'italian' && reverse && store.state.settings.autoPlay) speakIt(current.front);
    showCard(true);
  }

  // ----- multiple choice -----
  let answeredOption = null;
  function drawMcq() {
    answeredOption = null;
    stage.append(renderFace(current, 'front', { reverse, onSpeak }));
    const list = h('div', { class: 'options', role: 'group', 'aria-label': 'Choose the answer' });
    mcq.forEach((o, i) => {
      list.append(h('button', { class: 'option', 'data-id': o.id, onclick: () => choose(o, list) }, h('span', { class: 'option-key' }, String(i + 1)), h('span', { class: 'option-text' }, o.text), h('span', { class: 'option-mark', 'aria-hidden': 'true' })));
    });
    controls.append(list);
  }

  function choose(o, list) {
    if (answeredOption) return;
    answeredOption = o;
    const ms = performance.now() - cardStart;
    const ok = !!o.correct;
    const g = ok ? (ms <= 8000 ? GRADE.GOOD : GRADE.HARD) : GRADE.AGAIN;
    for (const b of list.querySelectorAll('.option')) {
      b.disabled = true;
      const opt = mcq.find((x) => String(x.id) === b.dataset.id);
      const mark = b.querySelector('.option-mark');
      if (opt.correct) {
        b.classList.add('right');
        mark.append(icon('check', 20));
      } else if (opt === o) {
        b.classList.add('wrong');
        mark.append(icon('x', 20));
      }
    }
    // show the full answer with notes
    clear(stage);
    stage.append(renderFace(current, 'back', { reverse, onSpeak }));
    if (current.kind === 'italian' && reverse && store.state.settings.autoPlay) speakIt(current.front);
    record(g, 'q', ms, ok ? undefined : o.id);
    const nextBtn = h('button', { class: 'btn primary big', onclick: () => next() }, ok ? 'Next' : 'Next card');
    controls.append(nextBtn);
    nextBtn.focus({ preventScroll: true });
    // A right answer moves on by itself; a wrong one waits so you can read the correct answer.
    if (ok) autoTimer = setTimeout(next, 1400);
  }

  // ----- answering -----
  function grade(g, m) {
    const ms = performance.now() - cardStart;
    record(g, m, ms);
    next();
  }

  // Applies the answer, logs it, requeues learning cards. Returns the new schedule (or null in practice).
  function record(g, m, ms, wrongId) {
    const now = Date.now();
    const card = current;
    const entry = { t: now, c: card.id, d: card.deckId, g, m, s: scheduled ? 1 : 0, ps: STATE_CODE[card.srs.state] || 'n', ms: Math.round(Math.min(ms, 60000)) };
    if (wrongId) entry.x = wrongId;
    let after = null;
    let prev = null;
    if (scheduled) {
      const cfg = configFor(store.state.settings, card.kind, now);
      after = schedule(card.srs, g, now, cfg);
      prev = store.answerCard(card.id, after, entry);
      if (g === GRADE.AGAIN && after.lapses === cfg.leechThreshold) {
        toast(`"${card.front}" has slipped ${after.lapses} times. Try rewording it.`, { action: 'Edit', onAction: () => openCardEditor({ cardId: card.id }), ms: 6000 });
      }
    } else {
      store.logEntry(entry);
    }
    stats.n++;
    if (g >= 2) stats.ok++;
    stats.ms += entry.ms;
    undoStack.push({ cardId: card.id, prev, entry, queue: [...queue], missed: new Set(missed), stats: { ...stats, n: stats.n - 1, ok: stats.ok - (g >= 2 ? 1 : 0), ms: stats.ms - entry.ms }, scheduled });
    if (undoStack.length > 8) undoStack.shift();
    if (g === 1) missed.add(card.id);

    queue.shift();
    let offset = -1;
    if (scheduled) offset = requeueOffset(after, now);
    else if (g === 1) offset = 4;
    if (offset >= 0) queue.splice(Math.min(offset, queue.length), 0, card.id);
    return after;
  }

  function undo() {
    const u = undoStack.pop();
    if (!u) return;
    clearTimeout(autoTimer);
    if (u.scheduled) store.undoAnswer(u.cardId, u.prev, u.entry);
    else store.undoAnswer(u.cardId, null, u.entry);
    queue = u.queue;
    missed = u.missed;
    Object.assign(stats, u.stats);
    toast('Last answer undone');
    showCard(false);
  }

  // ----- summary -----
  function summary() {
    clearTimeout(autoTimer);
    current = null;
    clear(stage);
    clear(controls);
    editBtn.disabled = true;
    undoBtn.disabled = undoStack.length === 0;
    const acc = stats.n ? Math.round((stats.ok / stats.n) * 100) : 0;
    const mins = Math.max(1, Math.round(stats.ms / 60000));
    const redo = initial.map((id) => store.state.cards.get(id)).filter((c) => c && missed.has(c.id));
    const more = opts.buildMore ? opts.buildMore() : [];
    stage.append(
      h(
        'div',
        { class: 'summary' },
        h('h2', null, stats.n === 0 ? 'Nothing to study' : 'Arrived'),
        h('p', { class: 'summary-big' }, `${stats.ok} of ${stats.n} remembered`),
        h('p', { class: 'dim' }, `${acc}% correct in about ${mins} ${mins === 1 ? 'minute' : 'minutes'}.`),
        redo.length
          ? h('div', { class: 'stack' }, h('h3', null, 'Cards that tripped you up'), h('ul', { class: 'plain-list' }, redo.slice(0, 8).map((c) => h('li', null, h('strong', null, c.front), ' ', h('span', { class: 'dim' }, c.back)))))
          : null,
      ),
    );
    controls.append(more.length ? h('div', { class: 'grades two' }, h('button', { class: 'btn ghost big', onclick: () => finish(true) }, 'Done'), h('button', { class: 'btn primary big', onclick: () => { opts.ids = more; restart(more); } }, `Study ${more.length} more`)) : h('button', { class: 'btn primary big', onclick: () => finish(true) }, 'Done'));
  }

  function restart(ids) {
    queue = [...ids];
    initial.length = 0;
    initial.push(...ids);
    missed = new Set();
    stats.n = stats.ok = stats.ms = 0;
    undoStack.length = 0;
    editBtn.disabled = false;
    next();
  }

  // ----- keyboard (handy on a laptop) -----
  function onKey(e) {
    if (document.querySelector('.sheet.show')) return;
    if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'Escape') return requestClose();
    if ((e.key === 'z' || e.key === 'Z') && !e.metaKey && !e.ctrlKey) return undo();
    if (!current) return;
    if (mode === 'f') {
      if (phase === 'front' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        reveal();
      } else if (phase === 'back' && /^[1-4]$/.test(e.key)) grade(scheduled ? Number(e.key) : Number(e.key) <= 2 ? 1 : 3, 'f');
    } else if (mode === 'q') {
      if (!answeredOption && /^[1-4]$/.test(e.key)) controls.querySelectorAll('.option')[Number(e.key) - 1]?.click();
      else if (answeredOption && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        next();
      }
    }
  }
  document.addEventListener('keydown', onKey);

  next();
  return { close: () => finish(true) };
}
