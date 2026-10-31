// Pronounce an English word or sentence with the chosen voice.

import * as store from '../store.js';
import { speak, loadVoices, unlockSpeech } from '../speech.js';

export async function speakText(text) {
  unlockSpeech();
  await loadVoices();
  const st = store.state.settings;
  return speak(text, { lang: 'en-US', rate: st.speechRate, voiceURI: st.enVoiceURI });
}

// Speak automatically only if the person turned that on in More.
export function autoSpeak(text) {
  if (store.state.settings.autoSpeak) speakText(text);
}
