// Stats tab. Charts are plain SVG: one hue, thin marks, a tap-to-read line under each chart,
// and a table version for anyone who prefers numbers.

import { h, svg, clear, icon, deckDot } from '../ui.js';
import * as store from '../store.js';
import * as S from '../stats.js';
import { dayKey, addDays } from '../srs.js';

const pct = (x) => (x == null ? '–' : `${Math.round(x * 100)}%`);
const fmtDay = (ms) => new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const wk = (ms) => new Date(ms).toLocaleDateString(undefined, { weekday: 'short' });

function niceMax(v) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 4, 5, 10]) if (m * pow >= v) return m * pow;
  return v;
}

const W = 320;
const H = 150;
const PAD = { l: 30, r: 6, t: 8, b: 22 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;

function frame(yMax, ticks = 2, fmt = (v) => String(v)) {
  const g = svg('g');
  for (let i = 0; i <= ticks; i++) {
    const v = (yMax / ticks) * i;
    const y = PAD.t + plotH - (v / yMax) * plotH;
    g.append(svg('line', { x1: PAD.l, x2: W - PAD.r, y1: y, y2: y, class: i === 0 ? 'ax-base' : 'ax-grid' }), svg('text', { x: PAD.l - 5, y: y + 3.5, class: 'ax-text', 'text-anchor': 'end' }, fmt(v)));
  }
  return g;
}

function xLabels(labels) {
  const g = svg('g');
  const n = labels.length;
  const every = n > 14 ? Math.ceil(n / 5) : 1;
  labels.forEach((l, i) => {
    if (i % every !== 0 && i !== n - 1) return;
    if (i === n - 1 && n > 14 && (n - 1) % every < every / 2 && i % every !== 0) return;
    const x = PAD.l + (plotW / n) * (i + 0.5);
    g.append(svg('text', { x, y: H - 6, class: 'ax-text', 'text-anchor': 'middle' }, l));
  });
  return g;
}

// data: [{ label, value, tip }]
function columns(data, { yMax, fmt, name }) {
  const max = yMax || niceMax(Math.max(1, ...data.map((d) => d.value || 0)));
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': name });
  s.append(frame(max, 2, fmt), xLabels(data.map((d) => d.label)));
  const slot = plotW / data.length;
  const bw = Math.max(3, Math.min(14, slot * 0.6));
  const base = PAD.t + plotH;
  const hits = [];
  data.forEach((d, i) => {
    const x = PAD.l + slot * i + (slot - bw) / 2;
    const hgt = d.value ? Math.max(2, (d.value / max) * plotH) : 0;
    if (hgt) {
      const r = Math.min(3, bw / 2, hgt);
      s.append(svg('path', { d: `M${x},${base} V${base - hgt + r} a${r},${r} 0 0 1 ${r},${-r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} V${base} Z`, class: 'bar' }));
    }
    hits.push(svg('rect', { x: PAD.l + slot * i, y: PAD.t, width: slot, height: plotH + 14, class: 'hit', 'data-i': i }, svg('title', {}, d.tip)));
  });
  s.append(...hits);
  return s;
}

// data: [{ label, value|null, tip }] value on 0..yMax
function line(data, { yMax = 100, fmt, name }) {
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': name });
  s.append(frame(yMax, 2, fmt), xLabels(data.map((d) => d.label)));
  const slot = plotW / data.length;
  const px = (i) => PAD.l + slot * (i + 0.5);
  const py = (v) => PAD.t + plotH - (v / yMax) * plotH;
  let seg = [];
  const flush = () => {
    if (seg.length > 1) s.append(svg('polyline', { points: seg.map(([x, y]) => `${x},${y}`).join(' '), class: 'ln' }));
    seg = [];
  };
  data.forEach((d, i) => {
    if (d.value == null) return flush();
    seg.push([px(i), py(d.value)]);
  });
  flush();
  data.forEach((d, i) => {
    if (d.value != null) s.append(svg('circle', { cx: px(i), cy: py(d.value), r: 3.5, class: 'pt' }));
  });
  data.forEach((d, i) => s.append(svg('rect', { x: PAD.l + slot * i, y: PAD.t, width: slot, height: plotH + 14, class: 'hit', 'data-i': i }, svg('title', {}, d.tip))));
  return s;
}

// Chart + tap readout + table alternative.
function chartBlock({ title, sub, chart, data, readoutDefault, cols }) {
  const readout = h('p', { class: 'readout', 'aria-live': 'polite' }, readoutDefault);
  chart.addEventListener('click', (e) => {
    const t = e.target.closest?.('.hit');
    if (!t) return;
    readout.textContent = data[Number(t.dataset.i)].tip;
    chart.querySelectorAll('.hit.on').forEach((x) => x.classList.remove('on'));
    t.classList.add('on');
  });
  const rows = data.filter((d) => d.row);
  return h(
    'section',
    { class: 'panel' },
    h('h2', null, title),
    sub ? h('p', { class: 'dim' }, sub) : null,
    chart,
    readout,
    h('details', { class: 'table-view' }, h('summary', null, 'Show as table'), h('div', { class: 'table-wrap' }, h('table', null, h('thead', null, h('tr', null, cols.map((c) => h('th', { scope: 'col' }, c)))), h('tbody', null, rows.map((d) => h('tr', null, d.row.map((c) => h('td', null, c)))))))),
  );
}

export function mount(el, ctx) {
  function render() {
    clear(el);
    const now = Date.now();
    const cards = store.cardList();
    const days = store.state.days;
    const root = h('div', { class: 'view' });
    el.append(root);
    root.append(h('div', { class: 'view-head' }, h('h1', null, 'Stats')));

    const everything = S.allEntries(days);
    if (!cards.length || !everything.length) {
      root.append(h('section', { class: 'panel empty' }, h('h2', null, 'Nothing to chart yet'), h('p', null, 'Answer a few cards in Study and your progress shows up here. Every answer is saved, including which wrong option you picked.')));
      if (cards.length) addMaturity(root, cards);
      return;
    }

    const today = S.summarize(days.get(dayKey(now)) || []);
    const wc = S.weekCompare(days, now);
    const all30 = S.allEntries(days, addDays(now, -29));
    const tr = S.trueRetention(all30);
    const streak = S.streak(days, now);

    root.append(
      h(
        'div',
        { class: 'kpis' },
        kpi(String(streak), streak === 1 ? 'day streak' : 'day streak'),
        kpi(String(today.n), today.n === 1 ? 'answer today' : 'answers today'),
        kpi(pct(tr), 'kept in memory, 30 days', 'Of cards you had already learned, the share you remembered when they came back.'),
      ),
      h('p', { class: 'dim' }, `This week: ${wc.thisWeek.n} answers, ${pct(wc.thisWeek.acc)} correct. Last week: ${wc.lastWeek.n} answers, ${pct(wc.lastWeek.acc)} correct.`),
    );

    // answers per day
    const d30 = S.lastNDays(days, 30, now);
    const colData = d30.map((d) => ({ label: new Date(d.ms).getDate().toString(), value: d.n, tip: `${fmtDay(d.ms)}: ${d.n} ${d.n === 1 ? 'answer' : 'answers'}${d.n ? `, ${pct(d.acc)} correct` : ''}`, row: [fmtDay(d.ms), d.n, d.n ? pct(d.acc) : '–'] }));
    root.append(chartBlock({ title: 'Answers per day', sub: 'Last 30 days', chart: columns(colData, { name: 'Answers per day for the last 30 days' }), data: colData, readoutDefault: 'Tap a bar to see that day.', cols: ['Day', 'Answers', 'Correct'] }));

    // accuracy
    const accData = d30.map((d) => ({ label: new Date(d.ms).getDate().toString(), value: d.n >= 5 ? Math.round(d.acc * 100) : null, tip: d.n >= 5 ? `${fmtDay(d.ms)}: ${pct(d.acc)} correct from ${d.n} answers` : `${fmtDay(d.ms)}: ${d.n ? 'too few answers to show a trend' : 'no answers'}`, row: d.n >= 5 ? [fmtDay(d.ms), pct(d.acc), d.n] : null }));
    root.append(chartBlock({ title: 'How much you remember', sub: 'Correct answers per day, shown for days with at least 5 answers', chart: line(accData, { fmt: (v) => `${Math.round(v)}%`, name: 'Percentage correct per day' }), data: accData, readoutDefault: 'Tap a day to see the detail.', cols: ['Day', 'Correct', 'Answers'] }));

    // forecast
    const fc = S.forecast(cards, now, 7);
    const fcData = fc.map((d, i) => ({ label: i === 0 ? 'Today' : wk(d.ms), value: d.count, tip: `${i === 0 ? 'Today (including anything overdue)' : fmtDay(d.ms)}: ${d.count} ${d.count === 1 ? 'card' : 'cards'} due`, row: [i === 0 ? 'Today' : fmtDay(d.ms), d.count] }));
    root.append(chartBlock({ title: 'Coming up', sub: 'Reviews due over the next 7 days, not counting new cards', chart: columns(fcData, { name: 'Reviews due in the next 7 days' }), data: fcData, readoutDefault: 'Tap a bar to see that day.', cols: ['Day', 'Cards due'] }));

    addMaturity(root, cards);

    // by deck
    const rows = S.byDeck(cards, store.state.decks, days, now);
    if (rows.length) {
      root.append(
        h(
          'section',
          { class: 'panel' },
          h('h2', null, 'By deck'),
          h('div', { class: 'list' }, rows.map((r) => h('div', { class: 'deck-stat' }, h('div', { class: 'deck-stat-head' }, deckDot(r.deck.kind), h('strong', null, r.deck.name), h('span', { class: 'dim' }, `${r.total} ${r.total === 1 ? 'card' : 'cards'}`)), h('p', { class: 'dim' }, `${r.mature} well known, ${r.young + r.learning} still learning, ${r.new} new. Last 30 days: ${r.answers30} answers, ${pct(r.acc30)} correct. Average gap ${r.avgIvl ? Math.round(r.avgIvl) + ' days' : 'not yet'}.`)))),
        ),
      );
    }

    // hardest + confusions
    const hard = S.hardest(cards, 8);
    if (hard.length) {
      root.append(
        h(
          'section',
          { class: 'panel' },
          h('h2', null, 'Hardest cards'),
          h('p', { class: 'dim' }, 'The cards you have forgotten most often.'),
          h('ul', { class: 'plain-list spaced' }, hard.map((c) => h('li', null, h('strong', null, c.front), ' ', h('span', { class: 'dim' }, c.back), h('span', { class: 'pill due right' }, `${c.srs.lapses}× forgotten`)))),
          h('button', { class: 'btn ghost', onclick: () => (location.hash = '#/study') }, 'Go to Study to practise weak cards'),
        ),
      );
    }
    const conf = S.confusions(all30, store.state.cards, 5);
    if (conf.length) {
      root.append(h('section', { class: 'panel' }, h('h2', null, 'Often mixed up'), h('p', { class: 'dim' }, 'Pairs you confused in multiple choice. Worth reading side by side.'), h('ul', { class: 'plain-list spaced' }, conf.map((p) => h('li', null, h('strong', null, p.a.front), ' and ', h('strong', null, p.b.front), h('span', { class: 'pill muted right' }, `${p.count}×`))))));
    }

    // speaking
    const sp = S.speakSummary(days, now, 14);
    if (sp.count) {
      const spData = sp.recent.map((d) => ({ label: new Date(d.ms).getDate().toString(), value: d.avg == null ? null : Math.round(d.avg), tip: d.avg == null ? `${fmtDay(d.ms)}: no speaking practice` : `${fmtDay(d.ms)}: average ${Math.round(d.avg)} from ${d.count} ${d.count === 1 ? 'try' : 'tries'}`, row: d.avg == null ? null : [fmtDay(d.ms), Math.round(d.avg), d.count] }));
      const blk = chartBlock({ title: 'Speaking and listening', sub: `Average score ${Math.round(sp.avg)} over ${sp.count} ${sp.count === 1 ? 'try' : 'tries'} in the last 14 days`, chart: line(spData, { fmt: (v) => String(Math.round(v)), name: 'Average speaking score per day' }), data: spData, readoutDefault: 'Tap a day to see the detail.', cols: ['Day', 'Average score', 'Tries'] });
      if (sp.weakest.length) blk.append(h('h3', null, 'Needs more practice'), h('ul', { class: 'plain-list spaced' }, sp.weakest.map((w) => h('li', null, h('span', { lang: 'it' }, w.tg), h('span', { class: 'pill due right' }, String(Math.round(w.avg)))))));
      root.append(blk);
    }
  }

  function kpi(value, label, help) {
    return h('div', { class: 'kpi', title: help || '' }, h('div', { class: 'kpi-num' }, value), h('div', { class: 'kpi-label' }, label));
  }

  function addMaturity(root, cards) {
    const m = S.maturity(cards);
    const total = cards.length || 1;
    const segs = [
      ['new', 'New', 'Not seen yet', m.new, 'var(--m-new)'],
      ['learning', 'Learning', 'In the first steps', m.learning, 'var(--m-learn)'],
      ['young', 'Young', 'Coming back within 3 weeks', m.young, 'var(--m-young)'],
      ['mature', 'Well known', 'Gaps of 3 weeks or more', m.mature, 'var(--m-mature)'],
    ];
    const bar = svg('svg', { viewBox: '0 0 320 22', class: 'stack-bar', role: 'img', 'aria-label': 'Cards by stage: ' + segs.map((s) => `${s[1]} ${s[3]}`).join(', ') });
    let x = 0;
    for (const s of segs) {
      const w = (s[3] / total) * 320;
      if (w > 0) bar.append(svg('rect', { x, y: 0, width: w, height: 22, fill: s[4], class: 'seg', stroke: 'var(--surface)', 'stroke-width': 2 }));
      x += w;
    }
    root.append(
      h(
        'section',
        { class: 'panel' },
        h('h2', null, 'Your cards'),
        h('p', { class: 'dim' }, `${cards.length} ${cards.length === 1 ? 'card' : 'cards'}${m.suspended ? `, ${m.suspended} paused` : ''}`),
        bar,
        h('ul', { class: 'legend' }, segs.map((s) => h('li', null, h('span', { class: 'swatch', style: { background: s[4] } }), h('span', null, h('strong', null, `${s[3]} `), s[1]), h('span', { class: 'dim' }, s[2])))),
      ),
    );
  }

  render();
  let t = null;
  return {
    update(kinds) {
      if (!kinds.some((k) => ['cards', 'days', 'decks', 'ready'].includes(k))) return;
      clearTimeout(t);
      t = setTimeout(render, 80);
    },
    destroy() {
      clearTimeout(t);
    },
  };
}
