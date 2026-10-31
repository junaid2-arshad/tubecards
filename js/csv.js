// CSV / TSV / pipe-separated import and export for cards. Pure functions.

const ALIASES = {
  deck: ['deck', 'deck name', 'set'],
  kind: ['type', 'kind', 'card type'],
  hook: ['hook', 'memory hook', 'memory aid', 'mnemonic'],
  front: ['front', 'word', 'term', 'question', 'prompt'],
  hint: ['hint', 'sentence', 'example', 'example sentence', 'context', 'usage'],
  back: ['back', 'meaning', 'definition', 'english', 'translation', 'answer'],
  notes: ['notes', 'note', 'synonyms', 'extra'],
  tags: ['tags', 'tag'],
  batch: ['week', 'batch'],
};

export const EXPORT_COLUMNS = ['deck', 'type', 'front', 'hint', 'back', 'notes', 'tags', 'week', 'hook'];

export const TEMPLATES = {
  gre: 'deck,type,front,hint,back,notes,tags,hook\nGRE Vocab,gre,ephemeral,"Fame in the music industry can be ephemeral.",lasting a very short time,"fleeting, transient",week-1,"ephemeral sounds like a fem-eral: a flower that dies in a day"\n',
};

export function detectDelimiter(text) {
  const first = (text.replace(/^﻿/, '').split(/\r?\n/).find((l) => l.trim()) || '');
  let best = ',';
  let bestCount = 0;
  for (const d of ['\t', '|', ';', ',']) {
    let count = 0;
    let inQ = false;
    for (const ch of first) {
      if (ch === '"') inQ = !inQ;
      else if (!inQ && ch === d) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

export function parseRows(text, delim = ',') {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += ch;
    } else if (ch === '"' && field === '') {
      inQ = true;
    } else if (ch === delim) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

export function toCsv(rows, delim = ',') {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return s.includes(delim) || s.includes('"') || /[\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(delim)).join('\n') + '\n';
}

// The app only holds GRE words now, so every imported row is a GRE card whatever its type column says.
export function normKind() {
  return 'gre';
}

function splitTags(s) {
  return String(s || '')
    .split(/[;|,]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function headerMap(row) {
  const map = {};
  row.forEach((h, i) => {
    const key = h.trim().toLowerCase();
    for (const [field, names] of Object.entries(ALIASES)) {
      if (names.includes(key) && !(field in map)) map[field] = i;
    }
  });
  return map;
}

// defaults: { deck, kind }. headerless: treat every row as: front | back | sentence | notes
export function parseCards(text, defaults = {}, { headerless = false } = {}) {
  const delim = detectDelimiter(text);
  const rows = parseRows(text, delim);
  const errors = [];
  const cards = [];
  if (!rows.length) return { cards, errors: [{ line: 0, msg: 'Nothing to import.' }], delimiter: delim, headerFound: false };

  let map = headerless ? null : headerMap(rows[0]);
  const headerFound = !!(map && 'front' in map && 'back' in map);
  if (!headerFound) map = { front: 0, back: 1, hint: 2, notes: 3 };
  const start = headerFound ? 1 : 0;

  for (let r = start; r < rows.length; r++) {
    const row = rows[r];
    const get = (f) => (f in map && map[f] < row.length ? String(row[map[f]]).trim() : '');
    const front = get('front');
    const back = get('back');
    const line = r + 1;
    if (!front || !back) {
      errors.push({ line, msg: !front ? 'Missing front' : 'Missing back' });
      continue;
    }
    const deck = get('deck') || defaults.deck || 'GRE Vocab';
    cards.push({
      deck,
      kind: 'gre',
      front,
      hint: get('hint'),
      back,
      notes: get('notes'),
      hook: get('hook'),
      tags: splitTags(get('tags')),
      batch: get('batch'),
    });
  }
  return { cards, errors, delimiter: delim, headerFound };
}

export function parseJsonCards(text, defaults = {}) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { cards: [], errors: [{ line: 0, msg: 'Not valid JSON.' }] };
  }
  const list = Array.isArray(data) ? data : Array.isArray(data?.cards) ? data.cards : [];
  const cards = [];
  const errors = [];
  list.forEach((o, i) => {
    const front = String(o.front ?? o.word ?? '').trim();
    const back = String(o.back ?? o.meaning ?? '').trim();
    if (!front || !back) {
      errors.push({ line: i + 1, msg: !front ? 'Missing front' : 'Missing back' });
      return;
    }
    const deck = String(o.deck || defaults.deck || 'GRE Vocab');
    cards.push({
      deck,
      kind: 'gre',
      front,
      hint: String(o.hint ?? o.sentence ?? '').trim(),
      back,
      notes: String(o.notes ?? '').trim(),
      hook: String(o.hook ?? '').trim(),
      tags: Array.isArray(o.tags) ? o.tags.map(String) : splitTags(o.tags),
      batch: String(o.week ?? o.batch ?? ''),
    });
  });
  return { cards, errors };
}

export function exportCardsCsv(cards, decks) {
  const rows = [EXPORT_COLUMNS];
  for (const c of cards) {
    rows.push([decks.get(c.deckId)?.name || '', 'gre', c.front, c.hint || '', c.back, c.notes || '', (c.tags || []).join(';'), c.batch || '', c.hook || '']);
  }
  return toCsv(rows);
}

export function cardKey(deckName, front) {
  return `${String(deckName).trim().toLowerCase()}||${String(front).trim().toLowerCase()}`;
}
