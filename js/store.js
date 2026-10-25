// App state and data operations. Views read `state` and call these functions.
// Every change is applied in memory first and then sent to the backend without waiting,
// so the app stays instant (and usable offline) while Firestore syncs in the background.

import { firebaseConfig, FIREBASE_SDK_VERSION, firebaseEnabled } from './firebase-config.js';
import { createLocalBackend } from './backend-local.js';
import { newSrs, isoWeek, dayKey } from './srs.js';
import { parseCards, cardKey } from './csv.js';
import { SAMPLE_GRE, SAMPLE_ITALIAN } from './sample.js';

export const DEFAULT_SETTINGS = {
  newPerDay: 10,
  sessionSize: 30,
  maxInterval: 365,
  examDate: '',
  quizStyle: 'mixed', // flip | mcq | mixed
  autoPlay: true,
  speechRate: 0.9,
  voiceURI: '',
  enVoiceURI: '',
  theme: 'auto', // auto | light | dark
};

export const state = {
  user: null,
  backendName: 'local',
  ready: false,
  loadError: null,
  decks: new Map(),
  cards: new Map(),
  settings: { ...DEFAULT_SETTINGS },
  days: new Map(),
  lastError: null,
};

let backend = null;
let stopListen = null;
const listeners = new Set();
let pending = new Set();
let flushTimer = null;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(kind) {
  pending.add(kind);
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const kinds = [...pending];
    pending = new Set();
    for (const fn of [...listeners]) {
      try {
        fn(kinds);
      } catch (e) {
        console.error(e);
      }
    }
  }, 0);
}

function reportError(e) {
  console.error(e);
  state.lastError = e;
  emit('error');
}
function fire(fn) {
  try {
    Promise.resolve(fn()).catch(reportError);
  } catch (e) {
    reportError(e);
  }
}

// ---------- setup ----------
export async function init(opts = {}) {
  if (opts.backend) {
    backend = opts.backend;
    state.backendName = backend.name;
  } else if (firebaseEnabled()) {
    state.backendName = 'firebase';
    try {
      const m = await import('./backend-firebase.js');
      backend = await m.createFirebaseBackend(firebaseConfig, FIREBASE_SDK_VERSION);
    } catch (e) {
      console.error(e);
      state.loadError = 'Could not load the sign-in service. Open the app once while online so it can be saved for offline use.';
      emit('auth');
      return;
    }
  } else {
    backend = createLocalBackend();
    state.backendName = 'local';
  }
  await new Promise((resolve) => {
    let first = true;
    backend.onAuth((user) => {
      handleAuth(user);
      if (first) {
        first = false;
        resolve();
      }
    });
  });
}

function clearData() {
  state.decks = new Map();
  state.cards = new Map();
  state.days = new Map();
  state.settings = { ...DEFAULT_SETTINGS };
  state.ready = false;
}

function handleAuth(user) {
  if (stopListen) {
    stopListen();
    stopListen = null;
  }
  state.user = user;
  clearData();
  if (user) startListening();
  emit('auth');
}

function applyChanges(map, ch, fix) {
  for (const u of ch.upserts) map.set(u.id, fix ? fix(u) : u);
  for (const id of ch.removes) map.delete(id);
}

function startListening() {
  const seen = new Set();
  const mark = (k) => {
    seen.add(k);
    if (seen.size === 4 && !state.ready) {
      state.ready = true;
      emit('ready');
    }
  };
  stopListen = backend.listen({
    decks: (ch) => {
      applyChanges(state.decks, ch);
      mark('decks');
      emit('decks');
    },
    cards: (ch) => {
      applyChanges(state.cards, ch, (c) => ({ tags: [], hint: '', notes: '', ...c, srs: { ...newSrs(), ...(c.srs || {}) } }));
      mark('cards');
      emit('cards');
    },
    settings: (s) => {
      state.settings = { ...DEFAULT_SETTINGS, ...(s || {}) };
      mark('settings');
      emit('settings');
    },
    days: (ch) => {
      for (const u of ch.upserts) state.days.set(u.id, u.entries || []);
      for (const id of ch.removes) state.days.delete(id);
      mark('days');
      emit('days');
    },
    error: (e) => {
      console.error(e);
      state.loadError = e?.code === 'permission-denied' ? 'This account is not allowed to read this data. Check that your user ID is in firestore.rules.' : 'Sync problem: ' + (e?.message || e);
      emit('error');
    },
  });
  const t = setTimeout(() => {
    if (!state.ready) {
      state.ready = true;
      emit('ready');
    }
  }, 6000);
  t.unref?.();
}

export function friendlyAuthError(e) {
  const code = e?.code || '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(code)) return 'Email or password is not right.';
  if (/invalid-email/.test(code)) return 'That email address does not look right.';
  if (/too-many-requests/.test(code)) return 'Too many attempts. Wait a few minutes and try again.';
  if (/network/.test(code)) return 'No connection. You need to be online to sign in the first time.';
  if (/user-disabled/.test(code)) return 'This account is disabled.';
  return 'Could not sign in. ' + (e?.message || '');
}

export const signIn = (email, password) => backend.signIn(email, password);
export const signOut = () => backend.signOut();
export const resetPassword = (email) => backend.resetPassword(email);

// ---------- helpers ----------
export function newId() {
  const a = new Uint8Array(10);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
}
export const deckList = () => [...state.decks.values()].sort((a, b) => a.name.localeCompare(b.name));
export const cardList = () => [...state.cards.values()];
export const deckNewLimit = (deckId) => state.decks.get(deckId)?.newPerDay ?? state.settings.newPerDay;
export const findDeck = (name) => deckList().find((d) => d.name.trim().toLowerCase() === String(name).trim().toLowerCase());

// ---------- decks ----------
export function ensureDeck(name, kind = 'basic') {
  const existing = findDeck(name);
  if (existing) return existing;
  const deck = { id: newId(), name: String(name).trim() || 'My cards', kind, newPerDay: state.settings.newPerDay, createdAt: Date.now() };
  state.decks.set(deck.id, deck);
  fire(() => backend.setDeck(deck));
  emit('decks');
  return deck;
}
export function updateDeck(id, patch) {
  const d = state.decks.get(id);
  if (!d) return;
  Object.assign(d, patch);
  fire(() => backend.setDeck(d));
  emit('decks');
}
export function deleteDeck(id) {
  const ids = cardList().filter((c) => c.deckId === id).map((c) => c.id);
  removeCards(ids);
  state.decks.delete(id);
  fire(() => backend.delDeck(id));
  emit('decks');
}

// ---------- cards ----------
function makeCard(f, now = Date.now()) {
  return {
    id: newId(),
    deckId: f.deckId,
    kind: f.kind || 'basic',
    front: f.front.trim(),
    hint: (f.hint || '').trim(),
    back: f.back.trim(),
    notes: (f.notes || '').trim(),
    tags: f.tags || [],
    batch: f.batch || isoWeek(now),
    createdAt: now,
    updatedAt: now,
    suspended: false,
    srs: newSrs(),
  };
}
export function addCard(fields) {
  const card = makeCard(fields);
  state.cards.set(card.id, card);
  fire(() => backend.setCard(card));
  emit('cards');
  return card;
}
export function updateCard(id, patch) {
  const c = state.cards.get(id);
  if (!c) return null;
  const clean = { ...patch, updatedAt: Date.now() };
  for (const k of ['front', 'hint', 'back', 'notes']) if (typeof clean[k] === 'string') clean[k] = clean[k].trim();
  Object.assign(c, clean);
  fire(() => backend.patchCard(id, clean));
  emit('cards');
  return c;
}
export function removeCards(ids) {
  if (!ids.length) return;
  for (const id of ids) state.cards.delete(id);
  fire(() => backend.delCards(ids));
  emit('cards');
}

// Import parsed rows. mode: 'update' keeps study progress but refreshes the text; 'skip' leaves existing cards alone.
export function importCards(rows, { mode = 'update' } = {}) {
  const byKey = new Map();
  for (const c of state.cards.values()) byKey.set(cardKey(state.decks.get(c.deckId)?.name || '', c.front), c);
  const now = Date.now();
  const toWrite = [];
  const newDecks = new Set();
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const had = findDeck(row.deck);
    const deck = ensureDeck(row.deck, row.kind);
    if (!had) newDecks.add(deck.name);
    const key = cardKey(deck.name, row.front);
    const ex = byKey.get(key);
    if (ex) {
      if (mode === 'skip') {
        skipped++;
        continue;
      }
      Object.assign(ex, { kind: row.kind, hint: row.hint, back: row.back, notes: row.notes, updatedAt: now });
      if (row.tags.length) ex.tags = row.tags;
      if (row.batch) ex.batch = row.batch;
      toWrite.push(ex);
      updated++;
    } else {
      const card = makeCard({ ...row, deckId: deck.id }, now);
      state.cards.set(card.id, card);
      byKey.set(key, card);
      toWrite.push(card);
      added++;
    }
  }
  if (toWrite.length) fire(() => backend.setCards(toWrite));
  emit('cards');
  return { added, updated, skipped, newDecks: [...newDecks] };
}

export function loadSample() {
  const a = importCards(parseCards(SAMPLE_GRE).cards, { mode: 'skip' });
  const b = importCards(parseCards(SAMPLE_ITALIAN).cards, { mode: 'skip' });
  return { added: a.added + b.added, skipped: a.skipped + b.skipped };
}

// ---------- answers ----------
export function logEntry(entry) {
  const key = dayKey(entry.t);
  state.days.set(key, [...(state.days.get(key) || []), entry]);
  fire(() => backend.addEntry(key, entry));
  emit('days');
}

// Scheduled answer: updates the card schedule and logs the answer. Returns the previous schedule for undo.
export function answerCard(cardId, srsAfter, entry) {
  const c = state.cards.get(cardId);
  const prev = c.srs;
  c.srs = srsAfter;
  fire(() => backend.patchCard(cardId, { srs: srsAfter }));
  logEntry(entry);
  emit('cards');
  return prev;
}

export function undoAnswer(cardId, prevSrs, entry) {
  const c = state.cards.get(cardId);
  if (c && prevSrs) {
    c.srs = prevSrs;
    fire(() => backend.patchCard(cardId, { srs: prevSrs }));
  }
  const key = dayKey(entry.t);
  const list = state.days.get(key) || [];
  state.days.set(key, list.filter((e) => !(e.t === entry.t && e.c === entry.c)));
  fire(() => backend.removeEntry(key, entry));
  emit('cards');
  emit('days');
}

// ---------- settings ----------
export function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  fire(() => backend.setSettings(state.settings));
  emit('settings');
}

// ---------- backup ----------
export function exportBackup() {
  return {
    app: 'tubecards',
    version: 1,
    exportedAt: new Date().toISOString(),
    decks: deckList(),
    cards: cardList(),
    settings: state.settings,
    days: Object.fromEntries(state.days),
  };
}

export function restoreBackup(obj) {
  if (!obj || obj.app !== 'tubecards') throw new Error('This file is not a TubeCards backup.');
  for (const d of obj.decks || []) {
    state.decks.set(d.id, d);
    fire(() => backend.setDeck(d));
  }
  const cards = (obj.cards || []).map((c) => ({ ...c, srs: { ...newSrs(), ...(c.srs || {}) } }));
  for (const c of cards) state.cards.set(c.id, c);
  if (cards.length) fire(() => backend.setCards(cards));
  if (obj.settings) saveSettings(obj.settings);
  for (const [day, entries] of Object.entries(obj.days || {})) {
    state.days.set(day, entries);
    fire(() => backend.setDay(day, entries));
  }
  emit('decks');
  emit('cards');
  emit('days');
  return { decks: (obj.decks || []).length, cards: cards.length };
}

// test helper
export function _backend() {
  return backend;
}
