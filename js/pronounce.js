// Compares what you were supposed to say with what the speech engine heard (or what you typed).
// Pure functions. Accent marks and punctuation are ignored because speech engines cannot be judged on them.

const NUM = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove', 'venti'];

export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`´]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (/^\d+$/.test(w) && Number(w) <= 20 ? NUM[Number(w)] : w));
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

export function similarity(a, b) {
  const m = Math.max(a.length, b.length);
  return m === 0 ? 1 : 1 - levenshtein(a, b) / m;
}

const CLOSE = 0.75;
const EXTRA_PENALTY = 0.25;

export function compare(target, heard) {
  const T = normalize(target);
  const H = normalize(heard);
  const n = T.length;
  const m = H.length;
  const subCost = (t, h) => {
    if (t === h) return 0;
    const s = similarity(t, h);
    return s >= CLOSE ? 1 - s : 1;
  };
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) dp[i][0] = i;
  for (let j = 1; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + subCost(T[i - 1], H[j - 1]));
    }
  }
  // backtrack
  const ops = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && Math.abs(dp[i][j] - (dp[i - 1][j - 1] + subCost(T[i - 1], H[j - 1]))) < 1e-9) {
      const t = T[i - 1];
      const h = H[j - 1];
      const s = similarity(t, h);
      ops.push(t === h ? { target: t, heard: h, status: 'ok', credit: 1 } : s >= CLOSE ? { target: t, heard: h, status: 'close', credit: s } : { target: t, heard: h, status: 'wrong', credit: 0 });
      i--;
      j--;
    } else if (i > 0 && Math.abs(dp[i][j] - (dp[i - 1][j] + 1)) < 1e-9) {
      ops.push({ target: T[i - 1], heard: '', status: 'missing', credit: 0 });
      i--;
    } else {
      ops.push({ target: '', heard: H[j - 1], status: 'extra', credit: 0 });
      j--;
    }
  }
  ops.reverse();
  const extras = ops.filter((o) => o.status === 'extra').length;
  const credit = ops.reduce((a, o) => a + o.credit, 0);
  const score = n === 0 ? 0 : Math.max(0, Math.min(100, Math.round((100 * (credit - EXTRA_PENALTY * extras)) / n)));
  return { score, ops, extras, targetWords: n, heardWords: m, perfect: score === 100 };
}

// Speech engines return several guesses; judge the best one.
export function bestOf(target, alternatives) {
  let best = null;
  for (const alt of alternatives) {
    const r = compare(target, alt);
    if (!best || r.score > best.score) best = { ...r, transcript: alt };
  }
  return best || { ...compare(target, ''), transcript: '' };
}

export function verdict(score) {
  if (score >= 90) return { label: 'Ottimo', level: 'great', note: 'Spot on.' };
  if (score >= 75) return { label: 'Bene', level: 'good', note: 'Nearly there. Check the highlighted words.' };
  if (score >= 50) return { label: 'Quasi', level: 'ok', note: 'Some words were missed. Listen again, then repeat.' };
  return { label: 'Riprova', level: 'low', note: 'Listen once more and try a slower pace.' };
}
