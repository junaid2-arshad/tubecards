// Local demo backend: everything lives in this browser's localStorage. No login.
// Used when Firebase is not configured, and by the automated tests.

const KEY = 'tubecards.local.v1';

function load() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { decks: {}, cards: {}, settings: null, days: {} };
}

export function createLocalBackend() {
  const db = load();
  let timer = null;
  const flush = () => {
    timer = null;
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      console.warn('Could not save local data', e);
    }
  };
  const save = () => {
    if (!timer) timer = setTimeout(flush, 250);
  };
  const user = { uid: 'local', email: 'Demo mode (this device only)' };

  return {
    name: 'local',
    onAuth(cb) {
      cb(user);
    },
    async signIn() {},
    async signOut() {},
    async resetPassword() {},
    listen(h) {
      h.decks({ upserts: Object.values(db.decks), removes: [] });
      h.cards({ upserts: Object.values(db.cards), removes: [] });
      h.settings(db.settings);
      h.days({ upserts: Object.entries(db.days).map(([id, entries]) => ({ id, entries })), removes: [] });
      return () => {};
    },
    async setDeck(d) {
      db.decks[d.id] = d;
      save();
    },
    async delDeck(id) {
      delete db.decks[id];
      save();
    },
    async setCard(c) {
      db.cards[c.id] = c;
      save();
    },
    async patchCard(id, patch) {
      db.cards[id] = { ...(db.cards[id] || { id }), ...patch };
      save();
    },
    async setCards(list) {
      for (const c of list) db.cards[c.id] = c;
      save();
    },
    async delCards(ids) {
      for (const id of ids) delete db.cards[id];
      save();
    },
    async setSettings(s) {
      db.settings = s;
      save();
    },
    async setDay(day, entries) {
      db.days[day] = entries;
      save();
    },
    async addEntry(day, entry) {
      (db.days[day] ||= []).push(entry);
      save();
    },
    async removeEntry(day, entry) {
      const list = db.days[day] || [];
      const i = list.findIndex((e) => e.t === entry.t && e.c === entry.c);
      if (i >= 0) list.splice(i, 1);
      save();
    },
    flush,
    _db: db,
  };
}
