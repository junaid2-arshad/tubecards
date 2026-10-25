// Firebase backend: email + password sign-in, Firestore with an offline cache.
// Writes are never awaited by the UI: Firestore queues them while you are offline
// (for example in a tunnel) and sends them when the connection returns.
//
// Data layout (all under users/{uid}, locked to your account by firestore.rules):
//   decks/{id}, cards/{id}, meta/settings, reviewDays/{YYYY-MM-DD} -> { day, entries: [...] }

const clean = (o) => JSON.parse(JSON.stringify(o));
const CHUNK = 400;

export async function createFirebaseBackend(config, version) {
  const base = `https://www.gstatic.com/firebasejs/${version}/`;
  const [appM, authM, fs] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')]);

  const app = appM.initializeApp(config);
  const auth = authM.getAuth(app);
  let db;
  try {
    db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
  } catch (e) {
    console.warn('Offline cache unavailable, using memory cache', e);
    db = fs.initializeFirestore(app, {});
  }

  const uid = () => auth.currentUser?.uid;
  const col = (name) => fs.collection(db, 'users', uid(), name);
  const ref = (name, id) => fs.doc(db, 'users', uid(), name, id);

  const changesOf = (snap) => {
    const upserts = [];
    const removes = [];
    snap.docChanges().forEach((ch) => {
      if (ch.type === 'removed') removes.push(ch.doc.id);
      else upserts.push({ id: ch.doc.id, ...ch.doc.data() });
    });
    return { upserts, removes };
  };

  const chunked = async (items, fn) => {
    for (let i = 0; i < items.length; i += CHUNK) {
      const batch = fs.writeBatch(db);
      items.slice(i, i + CHUNK).forEach((it) => fn(batch, it));
      await batch.commit();
    }
  };

  return {
    name: 'firebase',
    onAuth(cb) {
      authM.onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null));
    },
    signIn: (email, password) => authM.signInWithEmailAndPassword(auth, email, password),
    signOut: () => authM.signOut(auth),
    resetPassword: (email) => authM.sendPasswordResetEmail(auth, email),

    listen(h) {
      const since = new Date();
      since.setDate(since.getDate() - 120);
      const sinceKey = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')}`;
      const err = (e) => h.error(e);
      const unsubs = [
        fs.onSnapshot(col('decks'), (s) => h.decks(changesOf(s)), err),
        fs.onSnapshot(col('cards'), (s) => h.cards(changesOf(s)), err),
        fs.onSnapshot(ref('meta', 'settings'), (s) => h.settings(s.exists() ? s.data() : null), err),
        fs.onSnapshot(fs.query(col('reviewDays'), fs.where('day', '>=', sinceKey)), (s) => h.days(changesOf(s)), err),
      ];
      return () => unsubs.forEach((u) => u());
    },

    setDeck: (d) => fs.setDoc(ref('decks', d.id), clean(d)),
    delDeck: (id) => fs.deleteDoc(ref('decks', id)),
    setCard: (c) => fs.setDoc(ref('cards', c.id), clean(c)),
    patchCard: (id, patch) => fs.setDoc(ref('cards', id), clean(patch), { merge: true }),
    setCards: (list) => chunked(list, (b, c) => b.set(ref('cards', c.id), clean(c))),
    delCards: (ids) => chunked(ids, (b, id) => b.delete(ref('cards', id))),
    setSettings: (s) => fs.setDoc(ref('meta', 'settings'), clean(s)),
    setDay: (day, entries) => fs.setDoc(ref('reviewDays', day), { day, entries: clean(entries) }),
    addEntry: (day, entry) => fs.setDoc(ref('reviewDays', day), { day, entries: fs.arrayUnion(clean(entry)) }, { merge: true }),
    removeEntry: (day, entry) => fs.setDoc(ref('reviewDays', day), { day, entries: fs.arrayRemove(clean(entry)) }, { merge: true }),
  };
}
