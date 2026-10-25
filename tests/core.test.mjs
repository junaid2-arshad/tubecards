import test from 'node:test';
import assert from 'node:assert/strict';
import { GRADE, MIN, DAY, newSrs, computeNext, previewLabels, configFor, buildQueue, dueCounts, buildPractice, requeueOffset, addDays, startOfDay, dayKey, isoWeek } from '../js/srs.js';
import { parseCards, parseRows, detectDelimiter, toCsv, exportCardsCsv, parseJsonCards } from '../js/csv.js';
import { compare, bestOf, normalize, verdict } from '../js/pronounce.js';
import { summarize, streak, maturity, forecast, trueRetention, confusions, speakSummary, lastNDays } from '../js/stats.js';

const NOW = new Date(2026, 9, 24, 8, 30).getTime(); // 24 Oct 2026 08:30 local

test('new card walks through learning steps then graduates', () => {
  let s = newSrs();
  s = computeNext(s, GRADE.GOOD, NOW);
  assert.equal(s.state, 'learning');
  assert.equal(s.due, NOW + 10 * MIN);
  s = computeNext(s, GRADE.GOOD, NOW + 10 * MIN);
  assert.equal(s.state, 'review');
  assert.equal(s.ivl, 1);
  assert.equal(s.due, addDays(NOW + 10 * MIN, 1));
});

test('Again resets learning to first step', () => {
  let s = computeNext(newSrs(), GRADE.GOOD, NOW);
  s = computeNext(s, GRADE.AGAIN, NOW + MIN);
  assert.equal(s.step, 0);
  assert.equal(s.due, NOW + MIN + 1 * MIN);
});

test('Easy on a new card skips to 4 days', () => {
  const s = computeNext(newSrs(), GRADE.EASY, NOW);
  assert.equal(s.state, 'review');
  assert.equal(s.ivl, 4);
});

test('review intervals grow and are ordered hard < good < easy', () => {
  const base = { ...newSrs(), state: 'review', ivl: 10, ease: 2.5, due: startOfDay(NOW), reps: 5 };
  const h = computeNext(base, GRADE.HARD, NOW).ivl;
  const g = computeNext(base, GRADE.GOOD, NOW).ivl;
  const e = computeNext(base, GRADE.EASY, NOW).ivl;
  assert.ok(h > 10 && g > h && e > g, `${h} ${g} ${e}`);
  assert.equal(g, 25);
});

test('overdue cards get extra credit for good recall', () => {
  const base = { ...newSrs(), state: 'review', ivl: 10, ease: 2.5, due: addDays(NOW, -4), reps: 5 };
  assert.equal(computeNext(base, GRADE.GOOD, NOW).ivl, Math.round((10 + 2) * 2.5));
});

test('lapse drops ease, cuts interval and relearns', () => {
  const base = { ...newSrs(), state: 'review', ivl: 20, ease: 2.5, due: startOfDay(NOW), reps: 5 };
  const s = computeNext(base, GRADE.AGAIN, NOW);
  assert.equal(s.state, 'learning');
  assert.equal(s.relearn, true);
  assert.equal(s.lapses, 1);
  assert.equal(s.ivl, 8);
  assert.ok(Math.abs(s.ease - 2.3) < 1e-9);
  const back = computeNext(s, GRADE.GOOD, NOW + 10 * MIN);
  assert.equal(back.state, 'review');
  assert.equal(back.ivl, 8);
});

test('ease never falls below the floor and interval respects the cap', () => {
  let s = { ...newSrs(), state: 'review', ivl: 300, ease: 1.35, due: startOfDay(NOW) };
  assert.equal(computeNext(s, GRADE.HARD, NOW).ease, 1.3);
  assert.equal(computeNext(s, GRADE.EASY, NOW, { maxIvl: 365 }).ivl, 365);
});

test('fuzz stays within 5 percent band', () => {
  const base = { ...newSrs(), state: 'review', ivl: 40, ease: 2.5, due: startOfDay(NOW) };
  const lo = computeNext(base, GRADE.GOOD, NOW, {}, () => 0).ivl;
  const hi = computeNext(base, GRADE.GOOD, NOW, {}, () => 0.999).ivl;
  assert.ok(lo >= 95 && hi <= 105 && hi > lo, `${lo} ${hi}`);
});

test('preview labels are deterministic and readable', () => {
  const l = previewLabels(newSrs(), NOW);
  assert.deepEqual(l, { 1: '1m', 2: '6m', 3: '10m', 4: '4d' });
  const r = previewLabels({ ...newSrs(), state: 'review', ivl: 10, ease: 2.5, due: startOfDay(NOW) }, NOW);
  assert.equal(r[3], '25d');
  assert.equal(r[1], '10m');
});

test('GRE exam date caps interval, other decks unaffected', () => {
  const settings = { maxInterval: 365, examDate: dayKey(addDays(NOW, 30)) };
  assert.equal(configFor(settings, 'gre', NOW).maxIvl, 10);
  assert.equal(configFor(settings, 'italian', NOW).maxIvl, 365);
  assert.equal(configFor({ ...settings, examDate: dayKey(addDays(NOW, -3)) }, 'gre', NOW).maxIvl, 365);
});

function mk(id, deckId, srs, extra = {}) {
  return { id, deckId, front: id, back: id, createdAt: Number(id.replace(/\D/g, '')) || 0, srs, ...extra };
}
const rev = (due, ivl = 5) => ({ ...newSrs(), state: 'review', ivl, due, first: 1 });

test('queue: respects new-per-day, interleaves decks, ignores suspended and future cards', () => {
  const cards = [];
  for (let i = 0; i < 6; i++) cards.push(mk('a' + i, 'A', rev(startOfDay(NOW))));
  for (let i = 0; i < 6; i++) cards.push(mk('b' + i, 'B', rev(addDays(NOW, -1))));
  for (let i = 0; i < 8; i++) cards.push(mk('n' + i, 'A', newSrs()));
  cards.push(mk('future', 'A', rev(addDays(NOW, 3))));
  cards.push(mk('susp', 'A', rev(startOfDay(NOW)), { suspended: true }));
  const q = buildQueue(cards, NOW, { newPerDay: () => 3, rng: () => 0.3 });
  assert.equal(q.length, 12 + 3);
  assert.ok(!q.includes('future') && !q.includes('susp'));
  const decks = q.filter((id) => !id.startsWith('n')).map((id) => id[0]);
  assert.ok(decks.slice(0, 4).join('') !== 'aaaa' && decks.slice(0, 4).includes('b'), decks.join(''));
  assert.ok(q.indexOf('n0') > 0 && q.indexOf('n0') < q.length - 1, 'new cards are woven in');
});

test('queue: new cards already introduced today count against the limit', () => {
  const cards = [mk('s1', 'A', { ...newSrs(), state: 'learning', first: NOW - MIN, due: NOW + 5 * MIN }), mk('n1', 'A', newSrs()), mk('n2', 'A', newSrs())];
  const q = buildQueue(cards, NOW, { newPerDay: () => 2 });
  assert.deepEqual(q.sort(), ['n1', 's1']);
  assert.equal(dueCounts(cards, NOW, { newPerDay: () => 2 }).new, 1);
});

test('queue: size cap and deck/batch filter', () => {
  const cards = [];
  for (let i = 0; i < 20; i++) cards.push(mk('a' + i, 'A', rev(startOfDay(NOW)), { batch: i < 5 ? '2026-W43' : '2026-W42' }));
  assert.equal(buildQueue(cards, NOW, { size: 7 }).length, 7);
  assert.equal(buildQueue(cards, NOW, { batch: '2026-W43' }).length, 5);
  assert.equal(buildQueue(cards, NOW, { deckIds: new Set(['Z']) }).length, 0);
});

test('learning cards due later come last, due now come first', () => {
  const cards = [mk('later', 'A', { ...newSrs(), state: 'learning', due: NOW + 8 * MIN, first: 1 }), mk('r1', 'A', rev(startOfDay(NOW))), mk('now', 'A', { ...newSrs(), state: 'learning', due: NOW - MIN, first: 1 })];
  assert.deepEqual(buildQueue(cards, NOW), ['now', 'r1', 'later']);
});

test('practice weak cards picks lapsed cards only', () => {
  const cards = [mk('ok', 'A', rev(NOW, 30)), mk('bad', 'A', { ...rev(NOW, 2), lapses: 3, ease: 1.9 })];
  assert.deepEqual(buildPractice(cards, { kind: 'weak' }), ['bad']);
});

test('requeue offsets', () => {
  assert.equal(requeueOffset({ state: 'learning', due: NOW + MIN }, NOW), 3);
  assert.equal(requeueOffset({ state: 'learning', due: NOW + 10 * MIN }, NOW), 8);
  assert.equal(requeueOffset({ state: 'review', due: NOW + DAY }, NOW), -1);
});

test('iso week', () => {
  assert.equal(isoWeek(new Date(2026, 9, 24).getTime()), '2026-W43');
  assert.equal(isoWeek(new Date(2026, 0, 1).getTime()), '2026-W01');
});

// ---------- csv ----------
test('csv: header import with quotes, commas and aliases', () => {
  const text = 'Deck,Type,Word,Sentence,Meaning,Synonyms,Tags\nGRE Vocab,gre,ephemeral,"It was short-lived, a fleeting thing.",lasting a very short time,transient,w1;w2\nItaliano,italian,Ciao,,Hi,,\n';
  const r = parseCards(text);
  assert.equal(r.errors.length, 0);
  assert.equal(r.cards.length, 2);
  assert.equal(r.cards[0].hint, 'It was short-lived, a fleeting thing.');
  assert.deepEqual(r.cards[0].tags, ['w1', 'w2']);
  assert.equal(r.cards[1].kind, 'italian');
});

test('csv: tab separated, headerless quick add, bad rows reported', () => {
  const r = parseCards('ephemeral | lasting briefly | A fleeting joy | transient\nlonely |\n', { deck: 'GRE Vocab', kind: 'gre' }, { headerless: true });
  assert.equal(r.cards.length, 1);
  assert.equal(r.cards[0].hint, 'A fleeting joy');
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].line, 2);
  assert.equal(detectDelimiter('a\tb\tc'), '\t');
});

test('csv: round trip with embedded quotes and newlines', () => {
  const rows = [['a', 'say "hi"', 'x,y', 'line1\nline2']];
  assert.deepEqual(parseRows(toCsv(rows)), rows);
  const decks = new Map([['d1', { name: 'GRE' }]]);
  const out = exportCardsCsv([{ deckId: 'd1', kind: 'gre', front: 'f', hint: '', back: 'b', notes: '', tags: ['t1', 't2'], batch: '2026-W43' }], decks);
  const back = parseCards(out);
  assert.equal(back.cards[0].tags.length, 2);
  assert.equal(back.cards[0].deck, 'GRE');
});

test('json import', () => {
  const r = parseJsonCards(JSON.stringify({ cards: [{ deck: 'Italiano', front: 'gatto', back: 'cat' }, { front: 'x' }] }));
  assert.equal(r.cards.length, 1);
  assert.equal(r.cards[0].kind, 'italian');
  assert.equal(r.errors.length, 1);
});

// ---------- pronunciation ----------
test('pronounce: exact, accents and punctuation ignored', () => {
  assert.equal(compare('Vorrei un caffè, per favore.', 'vorrei un caffe per favore').score, 100);
  assert.deepEqual(normalize("L'acqua è fredda"), ['l', 'acqua', 'e', 'fredda']);
});

test('pronounce: digits normalised to Italian words', () => {
  assert.equal(compare('ho due gatti', 'ho 2 gatti').score, 100);
});

test('pronounce: missing, wrong and extra words are reported', () => {
  const r = compare('vorrei un caffè per favore', 'vorrei caffe per piacere');
  const status = r.ops.map((o) => o.status);
  assert.ok(status.includes('missing'));
  assert.ok(status.includes('wrong'));
  assert.ok(r.score > 30 && r.score < 80, String(r.score));
  const extra = compare('buongiorno', 'buongiorno a tutti');
  assert.equal(extra.extras, 2);
  assert.equal(extra.score, 50);
});

test('pronounce: near matches earn partial credit', () => {
  const r = compare('i gatti dormono', 'i gatto dormono');
  assert.equal(r.ops[1].status, 'close');
  assert.ok(r.score > 85 && r.score < 100);
});

test('pronounce: bestOf picks strongest alternative; verdict bands', () => {
  const b = bestOf('buona sera', ['buona sega', 'buona sera']);
  assert.equal(b.score, 100);
  assert.equal(b.transcript, 'buona sera');
  assert.equal(verdict(95).level, 'great');
  assert.equal(verdict(60).level, 'ok');
  assert.equal(verdict(10).level, 'low');
});

// ---------- stats ----------
function days(map) {
  return new Map(Object.entries(map));
}
test('stats: summarize, streak, retention, maturity', () => {
  const today = dayKey(NOW);
  const y = dayKey(addDays(NOW, -1));
  const d = days({
    [today]: [
      { g: 3, m: 'f', s: 1, ps: 'r', ms: 3000 },
      { g: 1, m: 'q', s: 1, ps: 'r', ms: 5000, c: 'a', x: 'b' },
      { g: 1, m: 'q', s: 1, ps: 'r', ms: 5000, c: 'b', x: 'a' },
      { m: 's', sc: 80, tg: 'ciao', c: 'z' },
    ],
    [y]: [{ g: 2, m: 'f', s: 1, ps: 'l', ms: 2000 }],
  });
  const s = summarize(d.get(today));
  assert.equal(s.n, 3);
  assert.equal(s.ok, 1);
  assert.equal(streak(d, NOW), 2);
  assert.equal(streak(days({ [y]: [{ g: 3, m: 'f' }] }), NOW), 1);
  assert.equal(streak(days({}), NOW), 0);
  assert.ok(Math.abs(trueRetention(d.get(today)) - 1 / 3) < 1e-9);
  const cm = new Map([['a', { id: 'a' }], ['b', { id: 'b' }]]);
  const conf = confusions(d.get(today), cm);
  assert.equal(conf.length, 1);
  assert.equal(conf[0].count, 2);
  const sp = speakSummary(d, NOW);
  assert.equal(sp.avg, 80);
  assert.equal(sp.weakest[0].tg, 'ciao');
  assert.equal(lastNDays(d, 7, NOW).length, 7);
  const last = lastNDays(d, 7, NOW);
  assert.equal(last[6].ms, startOfDay(NOW), 'day timestamp must not be overwritten by answer time');
  assert.equal(last[6].time, 13000);
  assert.equal(last[5].ms, addDays(NOW, -1));

  const cards = [
    { id: '1', srs: { state: 'review', ivl: 30, due: addDays(NOW, 2) } },
    { id: '2', srs: { state: 'review', ivl: 5, due: addDays(NOW, -1) } },
    { id: '3', srs: { state: 'learning', due: NOW } },
    { id: '4' },
    { id: '5', suspended: true },
  ];
  assert.deepEqual(maturity(cards), { new: 1, learning: 1, young: 1, mature: 1, suspended: 1 });
  const f = forecast(cards, NOW, 7);
  assert.equal(f[0].count, 2);
  assert.equal(f[2].count, 1);
});
