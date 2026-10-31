// Renders one side of a GRE card. Shared by study sessions, the editor preview and the practice drills.
// A speaker button (when onSpeak is given) reads the word, or its sentence, aloud in English.

import { h, icon, deckDot, emphasise } from '../ui.js';
import { state } from '../store.js';

// What is asked and what is the answer, depending on direction.
export function sidesOf(card, reverse = false) {
  return reverse
    ? { prompt: card.back, promptSub: '', answer: card.front, answerSub: card.hint }
    : { prompt: card.front, promptSub: card.hint, answer: card.back, answerSub: '' };
}

export function speakBtn(text, onSpeak, label) {
  return h('button', { type: 'button', class: 'icon-btn soft', 'aria-label': label, title: label, onclick: (e) => { e.stopPropagation(); onSpeak(text); } }, icon('speaker', 20));
}

// side: 'front' | 'back'.  opts: { reverse, onSpeak(text) }
export function renderFace(card, side, { reverse = false, onSpeak } = {}) {
  const deck = state.decks.get(card.deckId);
  const { prompt, promptSub, answer, answerSub } = sidesOf(card, reverse);
  const speakPrompt = onSpeak && !reverse;
  const speakAnswer = onSpeak && reverse;
  const sentence = (t) => emphasise(t, card.front);

  const top = h('div', { class: 'face-top' }, h('span', { class: 'face-deck' }, deckDot(), deck?.name || ''), card.suspended ? h('span', { class: 'tag' }, 'Paused') : null);
  const face = h('div', { class: 'face kind-gre side-' + side }, top);

  if (side === 'front') {
    face.append(h('div', { class: 'face-main-row' }, h('div', { class: 'face-main' }, prompt), speakPrompt ? speakBtn(prompt, onSpeak, 'Hear the word') : null));
    if (promptSub) {
      face.append(h('div', { class: 'face-sub-row' }, h('p', { class: 'face-sub' }, sentence(promptSub)), speakPrompt ? speakBtn(promptSub, onSpeak, 'Hear the sentence') : null));
    }
    return face;
  }

  // Back: a small recap of what was asked, then the answer large.
  face.append(h('div', { class: 'face-recap-row' }, h('div', { class: 'face-recap' }, prompt), speakPrompt ? speakBtn(prompt, onSpeak, 'Hear the word') : null));
  face.append(h('div', { class: 'face-main-row' }, h('div', { class: 'face-main answer' }, answer), speakAnswer ? speakBtn(answer, onSpeak, 'Hear the word') : null));
  if (answerSub) {
    face.append(h('div', { class: 'face-sub-row' }, h('p', { class: 'face-sub' }, sentence(answerSub)), speakAnswer ? speakBtn(answerSub, onSpeak, 'Hear the sentence') : null));
  } else if (!reverse && promptSub) {
    face.append(h('div', { class: 'face-sub-row' }, h('p', { class: 'face-sub dim' }, sentence(promptSub)), speakPrompt ? speakBtn(promptSub, onSpeak, 'Hear the sentence') : null));
  }
  if (card.notes) face.append(h('p', { class: 'face-notes' }, card.notes));
  if (card.hook) face.append(h('p', { class: 'face-hook' }, h('strong', null, 'Hook: '), card.hook));
  return face;
}
