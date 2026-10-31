// Analytics over cards and the review log. Pure functions.
//
// A log entry looks like:
//  { t: ms, c: cardId, d: deckId, g: 1-4, m: f flip|q choice|r typed|m match|c blank|w sentence|t question, s: 1 scheduled | 0 practice,
//    ps: 'n'|'l'|'r' (state before), ms: answer time, x: wrongly chosen cardId, q: question id }
// Grade 1 means you got it wrong; grades 2-4 mean you recalled it.

import { addDays, dayKey, startOfDay, DAY } from './srs.js';

export const isRecall = () => true;
export const isCorrect = (e) => e.g >= 2;

export function summarize(entries) {
  const rec = entries.filter(isRecall);
  const ok = rec.filter(isCorrect).length;
  const time = rec.reduce((a, e) => a + (e.ms || 0), 0);
  return { n: rec.length, ok, acc: rec.length ? ok / rec.length : null, time };
}

function dayEntries(days, key) {
  return days.get(key) || [];
}

export function lastNDays(days, n, todayMs) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const ms = addDays(todayMs, -i);
    const key = dayKey(ms);
    const s = summarize(dayEntries(days, key));
    out.push({ day: key, ms, ...s });
  }
  return out;
}

export function streak(days, todayMs) {
  let count = 0;
  let ms = startOfDay(todayMs);
  if (!dayEntries(days, dayKey(ms)).length) ms = addDays(ms, -1);
  while (dayEntries(days, dayKey(ms)).length) {
    count++;
    ms = addDays(ms, -1);
  }
  return count;
}

export function allEntries(days, sinceMs = 0) {
  const out = [];
  for (const [key, list] of days) {
    const [y, m, d] = key.split('-').map(Number);
    if (new Date(y, m - 1, d).getTime() >= sinceMs) out.push(...list);
  }
  return out;
}

// Of the cards that were already in long-term review when you answered, how many did you remember?
export function trueRetention(entries) {
  const rel = entries.filter((e) => e.m !== 's' && e.s === 1 && e.ps === 'r');
  if (!rel.length) return null;
  return rel.filter(isCorrect).length / rel.length;
}

export function maturity(cards) {
  const out = { new: 0, learning: 0, young: 0, mature: 0, suspended: 0 };
  for (const c of cards) {
    if (c.suspended) {
      out.suspended++;
      continue;
    }
    const s = c.srs;
    if (!s || s.state === 'new') out.new++;
    else if (s.state === 'learning') out.learning++;
    else if (s.ivl >= 21) out.mature++;
    else out.young++;
  }
  return out;
}

export function forecast(cards, nowMs, nDays = 7) {
  const out = [];
  for (let i = 0; i < nDays; i++) {
    const ms = addDays(nowMs, i);
    out.push({ day: dayKey(ms), ms, count: 0 });
  }
  const end = addDays(nowMs, nDays);
  for (const c of cards) {
    if (c.suspended || !c.srs) continue;
    const s = c.srs;
    if (s.state === 'learning') {
      if (s.due < addDays(nowMs, 1)) out[0].count++;
    } else if (s.state === 'review' && s.due < end) {
      const idx = Math.max(0, Math.round((startOfDay(s.due) - startOfDay(nowMs)) / DAY));
      if (idx < nDays) out[idx].count++;
    }
  }
  return out;
}

export function byDeck(cards, decks, days, todayMs) {
  const since = addDays(todayMs, -29);
  const entries = allEntries(days, since).filter(isRecall);
  const rows = [];
  for (const deck of decks.values()) {
    const dc = cards.filter((c) => c.deckId === deck.id);
    const m = maturity(dc);
    const de = entries.filter((e) => e.d === deck.id);
    const ok = de.filter(isCorrect).length;
    const reviewCards = dc.filter((c) => c.srs?.state === 'review');
    const avgIvl = reviewCards.length ? reviewCards.reduce((a, c) => a + c.srs.ivl, 0) / reviewCards.length : 0;
    rows.push({ deck, total: dc.length, ...m, answers30: de.length, acc30: de.length ? ok / de.length : null, avgIvl });
  }
  return rows;
}

export function hardest(cards, n = 8) {
  return cards
    .filter((c) => c.srs && c.srs.lapses > 0)
    .sort((a, b) => b.srs.lapses - a.srs.lapses || a.srs.ease - b.srs.ease)
    .slice(0, n);
}

// Pairs of cards you mix up in multiple choice.
export function confusions(entries, cardsMap, n = 5) {
  const pairs = new Map();
  for (const e of entries) {
    if ((e.m !== 'q' && e.m !== 'c') || !e.x || e.g !== 1) continue;
    const key = [e.c, e.x].sort().join('|');
    pairs.set(key, (pairs.get(key) || 0) + 1);
  }
  return [...pairs.entries()]
    .map(([k, count]) => {
      const [a, b] = k.split('|');
      return { a: cardsMap.get(a), b: cardsMap.get(b), count };
    })
    .filter((p) => p.a && p.b)
    .sort((x, y) => y.count - x.count)
    .slice(0, n);
}

export const ACTIVITY_LABEL = { f: 'Flip cards', q: 'Multiple choice', r: 'Typed recall', m: 'Matching', c: 'Fill the blank', w: 'Own sentences', t: 'GRE-style questions' };

// Answers and accuracy per kind of activity.
export function byActivity(entries) {
  const out = new Map();
  for (const e of entries) {
    if (!ACTIVITY_LABEL[e.m]) continue;
    const o = out.get(e.m) || { m: e.m, label: ACTIVITY_LABEL[e.m], n: 0, ok: 0 };
    o.n++;
    if (isCorrect(e)) o.ok++;
    out.set(e.m, o);
  }
  return [...out.values()].map((o) => ({ ...o, acc: o.n ? o.ok / o.n : null })).sort((a, b) => b.n - a.n);
}

// Cards that have left the "new" state.
export const learnedCount = (cards) => cards.filter((c) => !c.suspended && c.srs && c.srs.state !== 'new').length;

export function weekCompare(days, todayMs) {
  const cur = [];
  const prev = [];
  for (let i = 0; i < 7; i++) {
    cur.push(...dayEntries(days, dayKey(addDays(todayMs, -i))));
    prev.push(...dayEntries(days, dayKey(addDays(todayMs, -7 - i))));
  }
  return { thisWeek: summarize(cur), lastWeek: summarize(prev) };
}

export function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
