// Practice logic. Pure functions, no DOM.
//  - find a vocabulary word inside a sentence (any common ending: abate, abated, abating)
//  - build fill-in-the-blank questions from your own example sentences
//  - check a word you typed from memory
//  - check a sentence you wrote with the word

import { shuffle } from './srs.js';

export function normalizeWord(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// How much of the word must match at the start of a token. Short words must match almost fully.
function stemLength(n) {
  if (n <= 4) return n;
  if (n <= 6) return n - 1;
  return Math.max(4, n - 2);
}

// Returns { start, end, token } for the first token in `sentence` that is the word or an inflection of it.
export function findWord(sentence, word) {
  const text = String(sentence || '');
  const w = String(word || '').trim();
  if (!text || !w) return null;
  if (/[^\p{L}]/u.test(w)) {
    const i = text.toLowerCase().indexOf(w.toLowerCase());
    return i >= 0 ? { start: i, end: i + w.length, token: text.slice(i, i + w.length) } : null;
  }
  const target = normalizeWord(w);
  const stem = target.slice(0, stemLength(target.length));
  const re = /\p{L}+/gu;
  let m;
  while ((m = re.exec(text))) {
    const tok = normalizeWord(m[0]);
    if (tok.startsWith(stem) && tok.length <= target.length + 2) {
      return { start: m.index, end: m.index + m[0].length, token: m[0] };
    }
  }
  return null;
}

export function synonymsOf(card) {
  return new Set(
    String(card.notes || '')
      .split(/[,;.]/)
      .map((s) => normalizeWord(s))
      .filter((s) => s.length > 2),
  );
}

// Two words are "too close" to use as wrong answers for each other if one is listed as a synonym of the other.
function tooClose(a, b) {
  const sa = synonymsOf(a);
  const sb = synonymsOf(b);
  const fa = normalizeWord(a.front);
  const fb = normalizeWord(b.front);
  if (sa.has(fb) || sb.has(fa)) return true;
  for (const s of sa) if (sb.has(s)) return true;
  return false;
}

// card: the word being tested. pool: other cards to draw wrong answers from.
// opts.prefer: Set of card ids to try first (for example the batch you just met).
export function makeCloze(card, pool, rng = Math.random, opts = {}) {
  const { count = 4, prefer = null } = opts;
  const sentence = card.hint;
  const hit = findWord(sentence, card.front);
  if (!hit) return null;
  const me = normalizeWord(card.front);
  const candidates = pool.filter((c) => c.id !== card.id && normalizeWord(c.front) !== me && !tooClose(card, c));
  const first = shuffle(candidates.filter((c) => prefer?.has(c.id)), rng);
  const rest = shuffle(candidates.filter((c) => !prefer?.has(c.id)), rng);
  const wrong = [...first, ...rest].slice(0, count - 1);
  if (wrong.length < 2) return null;
  const options = shuffle([card, ...wrong], rng).map((c) => ({ id: c.id, text: c.front, meaning: c.back, correct: c.id === card.id }));
  return { card, before: sentence.slice(0, hit.start), after: sentence.slice(hit.end), token: hit.token, options };
}

// 'exact' | 'close' (one slip, counts as right) | 'wrong' | 'empty'
export function checkTyped(target, input) {
  const t = normalizeWord(target);
  const i = normalizeWord(input);
  if (!i) return 'empty';
  if (i === t) return 'exact';
  if (t.length >= 5 && levenshtein(t, i) <= 1) return 'close';
  if (t.length >= 9 && levenshtein(t, i) <= 2) return 'close';
  return 'wrong';
}

// Spelled-out hint: first letter and the right number of blanks.
export function letterHint(word) {
  const w = String(word || '');
  return w.slice(0, 1) + ' ' + Array.from(w.slice(1), () => '_').join(' ');
}

// Light check on a sentence you wrote. It cannot judge meaning; it checks you used the word and made a real sentence.
// returns { ok, reason: 'ok' | 'short' | 'missing' | 'copy' }
export function checkSentence(sentence, card) {
  const s = String(sentence || '').trim();
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 5) return { ok: false, reason: 'short' };
  if (!findWord(s, card.front)) return { ok: false, reason: 'missing' };
  if (card.hint && normalizeWord(s) === normalizeWord(card.hint)) return { ok: false, reason: 'copy' };
  return { ok: true, reason: 'ok' };
}

export const SENTENCE_MESSAGES = {
  short: 'Write a full sentence of at least five words.',
  missing: 'Use the word itself in your sentence. Any ending is fine, such as -ed or -ing.',
  copy: 'That is the example sentence. Write a new one about something from your own life.',
};

// Text to paste into any AI chat for feedback on a sentence.
export function feedbackPrompt(card, sentence) {
  return `I am studying for the GRE. Word: "${card.front}" (meaning: ${card.back}).\nMy sentence: "${sentence}"\nIs the word used correctly and naturally? If not, fix it and give one better example. Keep it short.`;
}

// Cards worth drilling first: weak ones, then ones you have not practised recently.
export function drillOrder(cards, rng = Math.random) {
  const score = (c) => {
    const s = c.srs || {};
    return (s.lapses || 0) * 2 + Math.max(0, 2.5 - (s.ease || 2.5)) * 3 + (s.state === 'learning' ? 2 : 0) + rng() * 2;
  };
  return cards.slice().sort((a, b) => score(b) - score(a));
}
