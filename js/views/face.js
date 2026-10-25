// Renders one side of a card. Shared by the study session, the editor preview and the speaking tab.
//
// Speaker buttons (when onSpeak is given):
//   Italian cards  the Italian phrase and its sentence, read in Italian
//   GRE cards      the word and its sentence, read in English, wherever the word is shown
//                  (front, back, or as the answer when you study in reverse)

import { h, icon, deckDot, emphasise } from '../ui.js';
import { state } from '../store.js';

const IT = 'it-IT';
const EN = 'en-US'; // the GRE is an American exam, so the word is read with a US voice by default

// What is asked and what is the answer, depending on direction.
export function sidesOf(card, reverse = false) {
  return reverse
    ? { prompt: card.back, promptSub: '', answer: card.front, answerSub: card.hint }
    : { prompt: card.front, promptSub: card.hint, answer: card.back, answerSub: '' };
}

function speakBtn(text, lang, onSpeak, label) {
  return h('button', { type: 'button', class: 'icon-btn soft', 'aria-label': label, title: label, onclick: (e) => { e.stopPropagation(); onSpeak(text, lang); } }, icon('speaker', 20));
}

// side: 'front' | 'back'.  opts: { reverse, onSpeak(text, lang) }
export function renderFace(card, side, { reverse = false, onSpeak } = {}) {
  const deck = state.decks.get(card.deckId);
  const { prompt, promptSub, answer, answerSub } = sidesOf(card, reverse);
  const italian = card.kind === 'italian';
  const gre = card.kind === 'gre';
  const lang = italian ? IT : EN;
  // Is the spoken language (Italian phrase / English GRE word) on this side's prompt or answer?
  const speakPrompt = onSpeak && !reverse && (italian || gre);
  const speakAnswer = onSpeak && reverse && (italian || gre);
  const sentence = gre ? (t) => emphasise(t, card.front) : (t) => t;

  const top = h('div', { class: 'face-top' }, h('span', { class: 'face-deck' }, deckDot(card.kind), deck?.name || ''), card.suspended ? h('span', { class: 'tag' }, 'Paused') : null);
  const face = h('div', { class: `face kind-${card.kind} side-${side}` }, top);

  if (side === 'front') {
    face.append(h('div', { class: 'face-main-row' }, h('div', { class: 'face-main' }, prompt), speakPrompt ? speakBtn(prompt, lang, onSpeak, gre ? 'Hear the word' : 'Listen') : null));
    if (promptSub) {
      face.append(h('div', { class: 'face-sub-row' }, h('p', { class: 'face-sub' }, sentence(promptSub)), speakPrompt ? speakBtn(promptSub, lang, onSpeak, 'Hear the sentence') : null));
    }
  } else {
    // Back: a small recap of the prompt, then the answer large.
    // For a GRE card studied the normal way, the recap is the word itself, so it gets the button.
    face.append(h('div', { class: 'face-recap-row' }, h('div', { class: 'face-recap' }, prompt), speakPrompt && gre ? speakBtn(prompt, lang, onSpeak, 'Hear the word') : null));
    face.append(h('div', { class: 'face-main-row' }, h('div', { class: 'face-main answer' }, answer), speakAnswer ? speakBtn(answer, lang, onSpeak, gre ? 'Hear the word' : 'Listen') : null));
    if (answerSub) {
      face.append(h('div', { class: 'face-sub-row' }, h('p', { class: 'face-sub' }, sentence(answerSub)), speakAnswer ? speakBtn(answerSub, lang, onSpeak, 'Hear the sentence') : null));
    } else if (!reverse && promptSub) {
      face.append(h('div', { class: 'face-sub-row' }, h('p', { class: 'face-sub dim' }, sentence(promptSub)), speakPrompt && gre ? speakBtn(promptSub, lang, onSpeak, 'Hear the sentence') : null));
    }
    if (card.notes) face.append(h('p', { class: 'face-notes' }, card.notes));
  }
  return face;
}
