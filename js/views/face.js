// Renders one side of a card. Shared by the study session, the editor preview and the speaking tab.

import { h, icon, deckDot, emphasise } from '../ui.js';
import { state } from '../store.js';

// What is asked and what is the answer, depending on direction.
export function sidesOf(card, reverse = false) {
  return reverse
    ? { prompt: card.back, promptSub: '', answer: card.front, answerSub: card.hint }
    : { prompt: card.front, promptSub: card.hint, answer: card.back, answerSub: '' };
}

function speakBtn(text, onSpeak, label = 'Listen') {
  return h('button', { type: 'button', class: 'icon-btn soft', 'aria-label': label, onclick: (e) => { e.stopPropagation(); onSpeak(text); } }, icon('speaker', 20));
}

// side: 'front' | 'back'.  opts: { reverse, onSpeak }
export function renderFace(card, side, { reverse = false, onSpeak } = {}) {
  const deck = state.decks.get(card.deckId);
  const { prompt, promptSub, answer, answerSub } = sidesOf(card, reverse);
  const italian = card.kind === 'italian';
  const showsItalianPrompt = italian && !reverse;
  const showsItalianAnswer = italian && reverse;

  const top = h('div', { class: 'face-top' }, h('span', { class: 'face-deck' }, deckDot(card.kind), deck?.name || ''), card.suspended ? h('span', { class: 'tag' }, 'Paused') : null);
  const face = h('div', { class: `face kind-${card.kind} side-${side}` }, top);

  if (side === 'front') {
    const main = h('div', { class: 'face-main-row' }, h('div', { class: 'face-main' }, prompt), showsItalianPrompt && onSpeak ? speakBtn(prompt, onSpeak) : null);
    face.append(main);
    if (promptSub) {
      const sub = card.kind === 'gre' ? emphasise(promptSub, card.front) : promptSub;
      face.append(h('div', { class: 'face-sub-row' }, h('p', { class: 'face-sub' }, sub), showsItalianPrompt && onSpeak ? speakBtn(promptSub, onSpeak, 'Listen to the sentence') : null));
    }
  } else {
    // Back: small recap of the prompt, then the answer large.
    face.append(h('div', { class: 'face-recap' }, prompt));
    const main = h('div', { class: 'face-main-row' }, h('div', { class: 'face-main answer' }, answer), showsItalianAnswer && onSpeak ? speakBtn(answer, onSpeak) : null);
    face.append(main);
    if (answerSub) {
      face.append(h('div', { class: 'face-sub-row' }, h('p', { class: 'face-sub' }, answerSub), showsItalianAnswer && onSpeak ? speakBtn(answerSub, onSpeak, 'Listen to the sentence') : null));
    } else if (!reverse && promptSub) {
      face.append(h('p', { class: 'face-sub dim' }, card.kind === 'gre' ? emphasise(promptSub, card.front) : promptSub));
    }
    if (card.notes) face.append(h('p', { class: 'face-notes' }, card.notes));
  }
  return face;
}
