import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };

const S = await import('../js/store.js');
const { createLocalBackend } = await import('../js/backend-local.js');
const { buildQueue, schedule, GRADE, newSrs, dueCounts } = await import('../js/srs.js');
const { parseCards } = await import('../js/csv.js');
const { SAMPLE_GRE, SAMPLE_ITALIAN } = await import('../js/sample.js');
const stats = await import('../js/stats.js');

const wait = (ms = 10) => new Promise((r) => setTimeout(r, ms));

test('init with local backend signs in and becomes ready', async () => {
  await S.init({ backend: createLocalBackend() });
  assert.ok(S.state.user);
  assert.equal(S.state.ready, true);
});

test('sample files parse cleanly', () => {
  for (const text of [SAMPLE_GRE, SAMPLE_ITALIAN]) {
    const r = parseCards(text);
    assert.equal(r.errors.length, 0, JSON.stringify(r.errors));
    assert.ok(r.cards.length >= 15);
  }
  assert.equal(parseCards(SAMPLE_ITALIAN).cards[0].kind, 'italian');
  assert.equal(parseCards(SAMPLE_GRE).cards[0].kind, 'gre');
});

test('load sample creates decks and cards, second load skips duplicates', () => {
  const r = S.loadSample();
  assert.equal(r.added, 15 + 16);
  assert.equal(S.deckList().length, 2);
  assert.equal(S.loadSample().added, 0);
  assert.equal(S.loadSample().skipped, 31);
});

test('import update keeps progress but refreshes text', () => {
  const card = S.cardList().find((c) => c.front === 'ephemeral');
  card.srs = { ...card.srs, state: 'review', ivl: 9, reps: 4 };
  const r = S.importCards(parseCards('deck,type,front,back\nGRE Vocab,gre,Ephemeral,short-lived\n').cards, { mode: 'update' });
  assert.equal(r.updated, 1);
  assert.equal(r.added, 0);
  assert.equal(card.back, 'short-lived');
  assert.equal(card.srs.ivl, 9);
});

test('add, edit and delete a card', () => {
  const deck = S.ensureDeck('GRE Vocab', 'gre');
  const c = S.addCard({ deckId: deck.id, kind: 'gre', front: 'tenacious', back: 'holding firm', hint: 'A tenacious climber.' });
  assert.match(c.batch, /^\d{4}-W\d{2}$/);
  S.updateCard(c.id, { back: 'persistent  ' });
  assert.equal(S.state.cards.get(c.id).back, 'persistent');
  S.removeCards([c.id]);
  assert.equal(S.state.cards.has(c.id), false);
});

test('answering schedules the card, logs the answer, and undo restores both', async () => {
  const now = Date.now();
  const c = S.cardList().find((x) => x.front === 'ubiquitous');
  const after = schedule(c.srs, GRADE.GOOD, now, {}, null);
  const entry = { t: now, c: c.id, d: c.deckId, g: 3, m: 'f', s: 1, ps: 'n', ms: 2500 };
  const prev = S.answerCard(c.id, after, entry);
  assert.equal(c.srs.state, 'learning');
  assert.equal(S.state.days.get(stats.summarize([]) && new Date(now).toISOString().slice(0, 0) + (await import('../js/srs.js')).dayKey(now)).length, 1);
  assert.equal(stats.summarize(S.state.days.get((await import('../js/srs.js')).dayKey(now))).n, 1);
  S.undoAnswer(c.id, prev, entry);
  assert.equal(c.srs.state, 'new');
  assert.equal(c.srs.first, 0);
  assert.equal(S.state.days.get((await import('../js/srs.js')).dayKey(now)).length, 0);
});

test('study queue honours the per-deck new card limit from the store', () => {
  const deck = S.deckList()[0];
  S.updateDeck(deck.id, { newPerDay: 3 });
  const q = buildQueue(S.cardList(), Date.now(), { newPerDay: S.deckNewLimit });
  const newFromDeck = q.filter((id) => S.state.cards.get(id).deckId === deck.id && S.state.cards.get(id).srs.state === 'new');
  assert.equal(newFromDeck.length, 3);
  assert.equal(dueCounts(S.cardList(), Date.now(), { newPerDay: S.deckNewLimit }).total, q.length);
});

test('persists to the local backend and survives a restart; backup round trip', async () => {
  S.saveSettings({ examDate: '2027-01-15', quizStyle: 'mcq' });
  S._backend().flush();
  const backup = S.exportBackup();
  assert.equal(backup.cards.length, 31);

  const raw = JSON.parse(mem.get('tubecards.local.v1'));
  assert.equal(Object.keys(raw.cards).length, 31);
  assert.equal(raw.settings.examDate, '2027-01-15');

  await S.init({ backend: createLocalBackend() });
  assert.equal(S.state.cards.size, 31);
  assert.equal(S.state.settings.quizStyle, 'mcq');

  mem.clear();
  await S.init({ backend: createLocalBackend() });
  assert.equal(S.state.cards.size, 0);
  const r = S.restoreBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(r.cards, 31);
  assert.equal(S.state.cards.size, 31);
  assert.throws(() => S.restoreBackup({ nope: 1 }));
});

test('deleting a deck removes its cards', async () => {
  const deck = S.deckList()[0];
  const n = S.cardList().filter((c) => c.deckId === deck.id).length;
  const before = S.state.cards.size;
  S.deleteDeck(deck.id);
  assert.equal(S.state.cards.size, before - n);
  assert.equal(S.state.decks.has(deck.id), false);
  await wait();
});

test('auth error messages are friendly', () => {
  assert.match(S.friendlyAuthError({ code: 'auth/invalid-credential' }), /not right/);
  assert.match(S.friendlyAuthError({ code: 'auth/network-request-failed' }), /online/);
});
