// Speak tab: three ways to practise Italian from your Italian cards.
//  Listen        hands-free playlist (Italian, then optionally English)
//  Read aloud    say the sentence and get word-by-word feedback
//  Type it       hear it and type it: silent, works offline, good for the train

import { h, clear, icon, segmented, field, toast, append } from '../ui.js';
import * as store from '../store.js';
import { shuffle } from '../srs.js';
import { bestOf, compare, verdict } from '../pronounce.js';
import { speak, stopSpeaking, loadVoices, ttsSupported, sttSupported, listen, describeSttError, unlockSpeech } from '../speech.js';

const sp = { tab: 'listen', deck: 'all', mode: 'sentences', shuffle: true, rep: 1, english: true, hideIt: false, custom: '' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Unlike the native append, this skips null/false and flattens arrays.
const put = (el, ...kids) => append(el, kids);

export function mount(el) {
  let items = [];
  let idx = 0;
  let runToken = 0;
  let playing = false;
  let rec = null;
  let alive = true;
  let body = null;

  const settings = () => store.state.settings;
  const voiceOpts = (lang, slow = false) => ({ lang, rate: slow ? Math.min(0.6, settings().speechRate) : settings().speechRate, voiceURI: lang.startsWith('it') ? settings().voiceURI : settings().enVoiceURI });

  function buildItems() {
    const cards = store.cardList().filter((c) => c.kind === 'italian' && !c.suspended && (sp.deck === 'all' || c.deckId === sp.deck) && (sp.mode === 'phrases' || c.hint));
    let list = cards.map((c) => ({ id: c.id, deckId: c.deckId, it: sp.mode === 'phrases' ? c.front : c.hint, en: c.back, key: c.front }));
    if (sp.shuffle) list = shuffle(list);
    if (sp.custom.trim()) list.unshift({ id: '', deckId: '', it: sp.custom.trim(), en: '', key: '', custom: true });
    items = list;
    idx = Math.min(idx, Math.max(0, items.length - 1));
  }

  function stopAll() {
    runToken++;
    playing = false;
    stopSpeaking();
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      rec = null;
    }
  }

  // ---------- layout ----------
  function render() {
    stopAll();
    clear(el);
    const root = h('div', { class: 'view' });
    el.append(root);
    root.append(h('div', { class: 'view-head' }, h('h1', null, 'Speak')));

    const italianDecks = store.deckList().filter((d) => store.cardList().some((c) => c.deckId === d.id && c.kind === 'italian'));
    if (!italianDecks.length && !sp.custom) {
      root.append(
        h('section', { class: 'panel empty' }, h('h2', null, 'No Italian cards yet'), h('p', null, 'This tab uses your Italian cards. Add some, load the samples, or type your own sentence below.'), h('div', { class: 'row wrap' }, h('button', { class: 'btn primary', onclick: () => { store.loadSample(); toast('Sample cards loaded'); render(); } }, 'Load sample cards'))),
      );
    }

    root.append(segmented({ label: 'Practice type', value: sp.tab, options: [{ value: 'listen', label: 'Listen' }, { value: 'read', label: 'Read aloud' }, { value: 'type', label: 'Type it' }], onChange: (v) => { sp.tab = v; render(); } }));

    // options
    const deckSel = h('select', { class: 'input', 'aria-label': 'Deck', onchange: (e) => { sp.deck = e.target.value; idx = 0; render(); } }, h('option', { value: 'all' }, 'All Italian decks'), italianDecks.map((d) => h('option', { value: d.id, selected: sp.deck === d.id }, d.name)));
    const custom = h('input', { class: 'input', type: 'text', value: sp.custom, placeholder: 'Type a sentence to practise', lang: 'it', 'aria-label': 'Your own Italian sentence' });
    const options = h(
      'details',
      { class: 'panel options' },
      h('summary', null, 'Options'),
      h(
        'div',
        { class: 'stack' },
        field('Deck', deckSel),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Practise with'), segmented({ label: 'Practise with', value: sp.mode, options: [{ value: 'sentences', label: 'Example sentences' }, { value: 'phrases', label: 'Phrases' }], onChange: (v) => { sp.mode = v; idx = 0; render(); } })),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: sp.shuffle, onchange: (e) => { sp.shuffle = e.target.checked; idx = 0; render(); } }), h('span', null, 'Shuffle order')),
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, `Speed ${Math.round(settings().speechRate * 100)}%`), h('input', { type: 'range', min: 0.5, max: 1.1, step: 0.05, value: settings().speechRate, oninput: (e) => { store.saveSettings({ speechRate: Number(e.target.value) }); e.target.previousSibling.textContent = `Speed ${Math.round(Number(e.target.value) * 100)}%`; } })),
        h('div', { class: 'field' }, custom, h('button', { class: 'btn ghost small', onclick: () => { sp.custom = custom.value; idx = 0; render(); } }, 'Use my sentence')),
      ),
    );
    root.append(options);

    buildItems();
    body = h('section', { class: 'speak-body' });
    root.append(body);
    if (!ttsSupported()) put(body, h('p', { class: 'notice' }, 'This browser cannot speak out loud, so listening practice is unavailable.'));
    if (!items.length) {
      put(body, h('p', { class: 'dim pad' }, sp.mode === 'sentences' ? 'No Italian cards with an example sentence yet. Add a sentence to a card, or switch to Phrases in Options.' : 'No Italian cards to practise.'));
      return;
    }
    if (sp.tab === 'listen') drawListen();
    else if (sp.tab === 'read') drawRead();
    else drawType();
    loadVoices();
  }

  const nav = (onChange) =>
    h(
      'div',
      { class: 'nav-row' },
      h('button', { class: 'icon-btn', 'aria-label': 'Previous', onclick: () => { idx = (idx - 1 + items.length) % items.length; onChange(); } }, icon('prev')),
      h('span', { class: 'dim' }, `${idx + 1} of ${items.length}`),
      h('button', { class: 'icon-btn', 'aria-label': 'Next', onclick: () => { idx = (idx + 1) % items.length; onChange(); } }, icon('next')),
    );

  const itemCard = (it, { hide = false } = {}) =>
    h(
      'div',
      { class: 'speak-card' },
      hide ? h('p', { class: 'speak-it hidden-text' }, 'Listen first, then say it.') : h('p', { class: 'speak-it', lang: 'it' }, it.it),
      !hide && it.en ? h('p', { class: 'speak-en' }, sp.mode === 'sentences' && it.key ? `${it.key}: ${it.en}` : it.en) : null,
    );

  // ---------- Listen ----------
  function drawListen() {
    clear(body);
    const it = items[idx];
    const status = h('p', { class: 'dim center', 'aria-live': 'polite' }, playing ? 'Playing…' : 'Tap play. Keep the screen on, because the iPhone pauses speech when it locks.');
    const card = h('div', { class: 'card-slot' }, itemCard(it, { hide: sp.hideIt && playing }));
    const playBtn = h('button', { class: 'btn primary big play', 'aria-label': playing ? 'Pause' : 'Play', onclick: () => (playing ? pausePlaylist() : startPlaylist()) }, icon(playing ? 'pause' : 'play', 26), playing ? 'Pause' : 'Play');
    put(body, 
      card,
      status,
      h('div', { class: 'row center' }, playBtn),
      nav(() => { const was = playing; pausePlaylist(); drawListen(); if (was) startPlaylist(); }),
      h(
        'div',
        { class: 'stack' },
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: sp.english, onchange: (e) => (sp.english = e.target.checked) }), h('span', null, sp.mode === 'sentences' ? 'Say the key phrase in English after each one' : 'Say the English after each one')),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: sp.hideIt, onchange: (e) => (sp.hideIt = e.target.checked) }), h('span', null, 'Hide the Italian text while playing (listening only)')),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Repeat each sentence'), segmented({ label: 'Repeat', value: String(sp.rep), options: [{ value: '1', label: 'Once' }, { value: '2', label: 'Twice' }, { value: '3', label: 'Three times' }], onChange: (v) => (sp.rep = Number(v)) })),
      ),
    );
  }

  async function startPlaylist() {
    unlockSpeech();
    await loadVoices();
    const my = ++runToken;
    playing = true;
    drawListen();
    while (my === runToken && idx < items.length) {
      const it = items[idx];
      for (let r = 0; r < sp.rep && my === runToken; r++) {
        await speak(it.it, voiceOpts('it-IT'));
        if (my !== runToken) return;
        await sleep(r < sp.rep - 1 ? 900 : 500);
      }
      if (sp.english && it.en && my === runToken) {
        await speak(it.en, voiceOpts('en-GB'));
        if (my !== runToken) return;
        await sleep(900);
      }
      if (my !== runToken) return;
      if (idx + 1 >= items.length) break;
      idx++;
      drawListen();
    }
    if (my === runToken) {
      playing = false;
      idx = 0;
      drawListen();
      toast('Playlist finished');
    }
  }

  function pausePlaylist() {
    runToken++;
    playing = false;
    stopSpeaking();
    if (alive && sp.tab === 'listen' && body?.isConnected) drawListen();
  }

  // ---------- result chips ----------
  function resultView(res, { typed = false } = {}) {
    const v = verdict(res.score);
    const chips = h('ul', { class: 'word-chips', 'aria-label': 'Word by word' });
    for (const o of res.ops) {
      const label = { ok: 'Right', close: 'Close', wrong: 'Different', missing: 'Missed', extra: 'Extra' }[o.status];
      const ic = { ok: 'check', close: 'tilde', wrong: 'x', missing: 'dash', extra: 'plus' }[o.status];
      const text = o.status === 'extra' ? o.heard : o.target;
      chips.append(
        h('li', { class: `wchip ${o.status}` }, icon(ic, 14), h('span', { class: 'wtext' }, text), o.status === 'wrong' || o.status === 'close' ? h('span', { class: 'wheard' }, `${typed ? 'typed' : 'heard'} ${o.heard}`) : null, h('span', { class: 'sr' }, label)),
      );
    }
    return h('div', { class: `result lvl-${v.level}`, 'aria-live': 'polite' }, h('div', { class: 'score-row' }, h('div', { class: 'score' }, String(res.score)), h('div', null, h('strong', { class: 'verdict' }, v.label), h('p', { class: 'dim' }, v.note))), chips);
  }

  function logSpeak(it, score, k) {
    store.logEntry({ t: Date.now(), c: it.id || '', d: it.deckId || '', m: 's', sc: score, tg: it.it.slice(0, 80), k });
  }

  // ---------- Read aloud ----------
  function drawRead(result, message) {
    clear(body);
    const it = items[idx];
    const hide = sp.hideIt && !result;
    const canListen = sttSupported();
    const mic = h('button', { class: 'btn primary big mic', disabled: !canListen, 'aria-label': 'Start speaking', onclick: () => attempt(it, mic, live) }, icon('mic', 24), 'Say it');
    const live = h('p', { class: 'live', 'aria-live': 'polite' }, message || '');
    put(body, 
      itemCard(it, { hide }),
      h('div', { class: 'row center wrap' }, h('button', { class: 'btn ghost', onclick: () => { unlockSpeech(); speak(it.it, voiceOpts('it-IT')); } }, icon('speaker', 20), 'Listen'), h('button', { class: 'btn ghost', onclick: () => { unlockSpeech(); speak(it.it, voiceOpts('it-IT', true)); } }, icon('speaker', 20), 'Slowly'), h('label', { class: 'check inline' }, h('input', { type: 'checkbox', checked: sp.hideIt, onchange: (e) => { sp.hideIt = e.target.checked; drawRead(result, message); } }), h('span', null, 'Hide text'))),
      h('div', { class: 'row center' }, mic),
      live,
      !canListen ? h('p', { class: 'notice' }, 'This browser cannot listen to you. Try Safari on your iPhone, or use Type it, which works anywhere.') : null,
      result ? resultView(result) : null,
      result ? h('div', { class: 'row center wrap' }, h('button', { class: 'btn ghost', onclick: () => drawRead() }, 'Try again'), h('button', { class: 'btn primary', onclick: () => { idx = (idx + 1) % items.length; drawRead(); } }, 'Next sentence')) : nav(() => drawRead()),
      h('p', { class: 'field-help center' }, 'The score shows how well the phone understood you. It is a useful guide, not an examiner, and it needs a connection.'),
    );
  }

  async function attempt(it, micBtn, live) {
    if (rec) {
      rec.stop();
      return;
    }
    stopSpeaking();
    micBtn.classList.add('recording');
    micBtn.lastChild.textContent = 'Listening… tap to stop';
    live.textContent = '';
    rec = listen({ lang: 'it-IT', onInterim: (t) => (live.textContent = t) });
    const mine = rec;
    try {
      const out = await mine.result;
      if (!alive || rec !== mine) return;
      rec = null;
      const res = bestOf(it.it, out.alternatives);
      logSpeak(it, res.score, 'r');
      drawRead({ ...res }, `You said: “${res.transcript}”${out.confidence ? ` (confidence ${Math.round(out.confidence * 100)}%)` : ''}`);
    } catch (e) {
      if (rec === mine) rec = null;
      if (!alive) return;
      drawRead(undefined, describeSttError(e?.code) || '');
    }
  }

  // ---------- Type it ----------
  function drawType(result, typedText = '') {
    clear(body);
    const it = items[idx];
    const input = h('textarea', { class: 'input', rows: 3, lang: 'it', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', placeholder: 'Type what you hear', 'aria-label': 'What you heard', value: typedText, disabled: !!result });
    put(body, 
      h('div', { class: 'speak-card' }, result ? h('p', { class: 'speak-it', lang: 'it' }, it.it) : h('p', { class: 'speak-it hidden-text' }, 'Press play and type what you hear.'), result && it.en ? h('p', { class: 'speak-en' }, sp.mode === 'sentences' && it.key ? `${it.key}: ${it.en}` : it.en) : null),
      h('div', { class: 'row center wrap' }, h('button', { class: 'btn primary', onclick: () => { unlockSpeech(); speak(it.it, voiceOpts('it-IT')); } }, icon('speaker', 20), 'Play'), h('button', { class: 'btn ghost', onclick: () => { unlockSpeech(); speak(it.it, voiceOpts('it-IT', true)); } }, icon('speaker', 20), 'Slowly')),
      input,
      result
        ? [resultView(result, { typed: true }), h('div', { class: 'row center wrap' }, h('button', { class: 'btn ghost', onclick: () => drawType() }, 'Try again'), h('button', { class: 'btn primary', onclick: () => { idx = (idx + 1) % items.length; drawType(); } }, 'Next sentence'))]
        : [h('div', { class: 'row center' }, h('button', { class: 'btn primary', onclick: () => { if (!input.value.trim()) return toast('Type what you heard first.'); const res = compare(it.it, input.value); logSpeak(it, res.score, 'd'); drawType(res, input.value); } }, 'Check')), nav(() => drawType())],
      h('p', { class: 'field-help center' }, 'Accent marks and punctuation are ignored when checking.'),
    );
  }

  render();
  return {
    update(kinds) {
      // Redraw only when cards change and nothing is playing or recording.
      if (kinds.some((k) => ['cards', 'decks', 'ready'].includes(k)) && !playing && !rec) {
        const keepIdx = idx;
        render();
        idx = Math.min(keepIdx, Math.max(0, items.length - 1));
      }
    },
    destroy() {
      alive = false;
      stopAll();
    },
  };
}
