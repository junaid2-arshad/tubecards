// Spaced-repetition scheduler and study-queue builder. Pure functions, no DOM, no network.
//
// Retention logic in plain words:
//  - New cards go through short learning steps (1 min, 10 min) inside the same session.
//  - Once graduated, a card comes back after 1 day, then the gap grows with every
//    successful recall (SM-2 style ease factor), and shrinks hard when you forget.
//  - Forgotten cards ("lapses") re-enter learning and return at 40% of their old gap.
//  - Reviews from different decks are interleaved, and new cards are woven in between
//    reviews, which helps discrimination and long-term retention.
//  - For GRE decks, an exam date caps the gap so every card is seen several times before the test.

export const GRADE = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 };
export const MIN = 60000;
export const DAY = 86400000;

export const DEFAULT_CONFIG = {
  steps: [1, 10], // minutes, new cards
  relearnSteps: [10], // minutes, after a lapse
  graduateIvl: 1, // days after finishing the steps
  easyIvl: 4, // days when "Easy" skips the steps
  startEase: 2.5,
  minEase: 1.3,
  maxEase: 3.5,
  maxIvl: 365,
  lapseMult: 0.4,
  hardMult: 1.2,
  easyBonus: 1.3,
  leechThreshold: 6,
};

export function newSrs() {
  return { state: 'new', step: 0, due: 0, ivl: 0, ease: DEFAULT_CONFIG.startEase, reps: 0, lapses: 0, last: 0, first: 0, relearn: false };
}

// ---- date helpers (local time, DST-safe) ----
export function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
export function addDays(ms, n) {
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
export function daysBetween(aMs, bMs) {
  return Math.round((startOfDay(bMs) - startOfDay(aMs)) / DAY);
}
export function dayKey(ms) {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
}
export function dayKeyToMs(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}
// ISO week label such as "2026-W43"; used to group cards you add each week.
export function isoWeek(ms) {
  const d = new Date(ms);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / DAY + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ---- scheduling ----
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

function fuzz(ivl, rng) {
  if (!rng || ivl < 3) return ivl;
  const range = ivl < 8 ? 1 : Math.max(1, Math.round(ivl * 0.05));
  return ivl + Math.floor(rng() * (2 * range + 1)) - range;
}
function clampIvl(x, c) {
  return clamp(Math.round(x), 1, c.maxIvl);
}

function graduate(s, ivl, now, c, rng) {
  s.state = 'review';
  s.relearn = false;
  s.step = 0;
  s.ivl = clampIvl(fuzz(clampIvl(ivl, c), rng), c);
  s.due = addDays(now, s.ivl);
  return s;
}

function learnStep(s, grade, now, c, rng) {
  if (s.state === 'new') {
    s.state = 'learning';
    s.step = 0;
    s.relearn = false;
  }
  const steps = s.relearn ? c.relearnSteps : c.steps;
  if (grade === GRADE.AGAIN) {
    s.step = 0;
    s.due = now + steps[0] * MIN;
  } else if (grade === GRADE.HARD) {
    const delay = s.step === 0 ? (steps.length > 1 ? (steps[0] + steps[1]) / 2 : steps[0] * 1.5) : steps[s.step];
    s.due = now + delay * MIN;
  } else if (grade === GRADE.GOOD) {
    if (s.step + 1 >= steps.length) return graduate(s, s.relearn ? Math.max(1, s.ivl) : c.graduateIvl, now, c, rng);
    s.step += 1;
    s.due = now + steps[s.step] * MIN;
  } else {
    return graduate(s, s.relearn ? Math.max(1, s.ivl) + 1 : c.easyIvl, now, c, rng);
  }
  return s;
}

function reviewStep(s, grade, now, c, rng) {
  const overdue = Math.max(0, daysBetween(s.due, now));
  const ivl = Math.max(1, s.ivl);
  if (grade === GRADE.AGAIN) {
    s.lapses += 1;
    s.ease = Math.max(c.minEase, s.ease - 0.2);
    s.ivl = Math.max(1, Math.round(ivl * c.lapseMult));
    s.state = 'learning';
    s.relearn = true;
    s.step = 0;
    s.due = now + c.relearnSteps[0] * MIN;
    return s;
  }
  const hard = Math.max(ivl + 1, Math.round(ivl * c.hardMult));
  const good = Math.max(hard + 1, Math.round((ivl + overdue / 2) * s.ease));
  const easy = Math.max(good + 1, Math.round((ivl + overdue) * s.ease * c.easyBonus));
  let next;
  if (grade === GRADE.HARD) {
    next = hard;
    s.ease = Math.max(c.minEase, s.ease - 0.15);
  } else if (grade === GRADE.GOOD) {
    next = good;
  } else {
    next = easy;
    s.ease = Math.min(c.maxEase, s.ease + 0.15);
  }
  s.ivl = clampIvl(fuzz(clampIvl(next, c), rng), c);
  s.due = addDays(now, s.ivl);
  return s;
}

// Returns a NEW srs object. Pass rng = null for a deterministic result with no fuzz.
export function computeNext(prev, grade, now, cfg = {}, rng = null) {
  const c = { ...DEFAULT_CONFIG, ...cfg };
  const s = { ...newSrs(), ...prev };
  s.reps += 1;
  s.last = now;
  if (!s.first) s.first = now;
  return s.state === 'review' ? reviewStep(s, grade, now, c, rng) : learnStep(s, grade, now, c, rng);
}

export function schedule(prev, grade, now, cfg = {}, rng = Math.random) {
  return computeNext(prev, grade, now, cfg, rng);
}

export function formatInterval(srsAfter, now) {
  if (srsAfter.state === 'review') {
    const d = srsAfter.ivl;
    if (d < 30) return `${d}d`;
    if (d < 365) return `${Math.round((d / 30.4) * 10) / 10}mo`.replace('.0', '');
    return `${Math.round((d / 365) * 10) / 10}y`.replace('.0', '');
  }
  const mins = Math.max(1, Math.round((srsAfter.due - now) / MIN));
  return mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`;
}

// Labels for the four answer buttons, e.g. { 1: "10m", 2: "1d", 3: "3d", 4: "7d" }.
export function previewLabels(prev, now, cfg = {}) {
  const out = {};
  for (const g of [1, 2, 3, 4]) out[g] = formatInterval(computeNext(prev, g, now, cfg, null), now);
  return out;
}

// Interval cap: the app setting, tightened for GRE decks when an exam date is set
// (a third of the time left, so you see each card at least a few more times).
export function configFor(settings = {}, deckKind = 'basic', now = Date.now()) {
  let maxIvl = Number(settings.maxInterval) || DEFAULT_CONFIG.maxIvl;
  if (deckKind === 'gre' && settings.examDate) {
    const left = daysBetween(now, dayKeyToMs(settings.examDate));
    if (left > 0) maxIvl = Math.max(1, Math.min(maxIvl, Math.floor(left / 3)));
  }
  return { ...DEFAULT_CONFIG, maxIvl };
}

export function isLeech(srs, cfg = DEFAULT_CONFIG) {
  return (srs?.lapses || 0) >= cfg.leechThreshold;
}

// ---- queue building ----
export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function interleaveByDeck(list) {
  const groups = new Map();
  for (const c of list) {
    if (!groups.has(c.deckId)) groups.set(c.deckId, []);
    groups.get(c.deckId).push(c);
  }
  const queues = [...groups.values()];
  const out = [];
  while (queues.some((q) => q.length)) {
    for (const q of queues) if (q.length) out.push(q.shift());
  }
  return out;
}

function weave(reviews, news) {
  if (!news.length) return reviews;
  if (!reviews.length) return news;
  const gap = Math.max(1, Math.floor(reviews.length / news.length));
  const out = [];
  let r = 0;
  let n = 0;
  while (r < reviews.length || n < news.length) {
    for (let k = 0; k < gap && r < reviews.length; k++) out.push(reviews[r++]);
    if (n < news.length) out.push(news[n++]);
  }
  return out;
}

export function newIntroducedToday(cards, now) {
  const sod = startOfDay(now);
  const m = new Map();
  for (const c of cards) {
    if (c.srs && c.srs.first >= sod) m.set(c.deckId, (m.get(c.deckId) || 0) + 1);
  }
  return m;
}

function inScope(c, opts) {
  if (c.suspended) return false;
  if (opts.deckIds && !opts.deckIds.has(c.deckId)) return false;
  if (opts.batch && c.batch !== opts.batch) return false;
  return true;
}

// Counts for the home screen.
export function dueCounts(cards, now, opts = {}) {
  const learnAhead = opts.learnAheadMs ?? 20 * MIN;
  const eod = addDays(now, 1);
  const used = newIntroducedToday(cards, now);
  const limitFor = opts.newPerDay || (() => 10);
  const left = new Map();
  const out = { learning: 0, review: 0, new: 0 };
  for (const c of cards) {
    if (!inScope(c, opts)) continue;
    const s = c.srs || newSrs();
    if (s.state === 'learning') {
      if (s.due <= now + learnAhead) out.learning++;
    } else if (s.state === 'review') {
      if (s.due < eod) out.review++;
    } else {
      const have = left.get(c.deckId) ?? Math.max(0, limitFor(c.deckId) - (used.get(c.deckId) || 0));
      if (have > 0) {
        out.new++;
        left.set(c.deckId, have - 1);
      } else left.set(c.deckId, 0);
    }
  }
  out.total = out.learning + out.review + out.new;
  return out;
}

// Scheduled study session: returns card ids in the order they should appear.
export function buildQueue(cards, now, opts = {}) {
  const rng = opts.rng || Math.random;
  const learnAhead = opts.learnAheadMs ?? 20 * MIN;
  const eod = addDays(now, 1);
  const limitFor = opts.newPerDay || (() => 10);
  const used = newIntroducedToday(cards, now);

  const learnNow = [];
  const learnLater = [];
  const reviews = [];
  const news = [];
  for (const c of cards) {
    if (!inScope(c, opts)) continue;
    const s = c.srs || newSrs();
    if (s.state === 'learning') {
      if (s.due <= now) learnNow.push(c);
      else if (s.due <= now + learnAhead) learnLater.push(c);
    } else if (s.state === 'review') {
      if (s.due < eod) reviews.push(c);
    } else news.push(c);
  }
  learnNow.sort((a, b) => a.srs.due - b.srs.due);
  learnLater.sort((a, b) => a.srs.due - b.srs.due);

  news.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const pickedNew = [];
  for (const c of news) {
    if ((used.get(c.deckId) || 0) < limitFor(c.deckId)) {
      pickedNew.push(c);
      used.set(c.deckId, (used.get(c.deckId) || 0) + 1);
    }
  }

  let body = weave(interleaveByDeck(shuffle(reviews, rng)), interleaveByDeck(pickedNew));
  if (opts.size) body = body.slice(0, Math.max(0, opts.size - learnNow.length - learnLater.length));
  return [...learnNow, ...body, ...learnLater].map((c) => c.id);
}

// Practice sessions never change the schedule.
export function weaknessScore(c) {
  const s = c.srs || newSrs();
  if (s.state === 'new') return 0;
  return s.lapses * 2 + Math.max(0, DEFAULT_CONFIG.startEase - s.ease) * 3 + (s.state === 'learning' ? 2 : 0) + (s.ivl < 7 ? 1 : 0);
}

export function buildPractice(cards, opts = {}) {
  const rng = opts.rng || Math.random;
  let pool = cards.filter((c) => inScope(c, opts));
  if (opts.kind === 'weak') {
    pool = pool.filter((c) => weaknessScore(c) > 0).sort((a, b) => weaknessScore(b) - weaknessScore(a));
    pool = pool.slice(0, opts.size || 20);
    pool = shuffle(pool, rng);
  } else if (opts.kind === 'ahead') {
    pool = pool.filter((c) => (c.srs?.state || 'new') === 'review').sort((a, b) => a.srs.due - b.srs.due).slice(0, opts.size || 20);
    pool = shuffle(pool, rng);
  } else {
    pool = interleaveByDeck(shuffle(pool, rng)).slice(0, opts.size || 30);
  }
  return pool.map((c) => c.id);
}

// After answering in a session, where should a card in learning come back?
// Returns how many cards later to show it, or -1 if it should wait for a future session.
export function requeueOffset(srsAfter, now) {
  if (srsAfter.state !== 'learning') return -1;
  const mins = (srsAfter.due - now) / MIN;
  if (mins <= 2) return 3;
  if (mins <= 10) return 8;
  if (mins <= 30) return 15;
  return -1;
}
