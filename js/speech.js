// Text-to-speech for hearing how a word is pronounced. Uses the browser's built-in voices,
// so it costs nothing and works offline once the iPhone voice is downloaded
// (Settings > Accessibility > Spoken Content > Voices).

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let voicesCache = [];

export function loadVoices(timeoutMs = 1500) {
  return new Promise((resolve) => {
    if (!ttsSupported()) return resolve([]);
    const got = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length) {
        voicesCache = v;
        return true;
      }
      return false;
    };
    if (got()) return resolve(voicesCache);
    const done = () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', onChange);
      resolve(voicesCache);
    };
    const onChange = () => {
      if (got()) done();
    };
    window.speechSynthesis.addEventListener?.('voiceschanged', onChange);
    setTimeout(done, timeoutMs);
  });
}

const langOf = (v) => String(v.lang || '').replace('_', '-').toLowerCase();

export function voicesFor(prefix) {
  return voicesCache.filter((v) => langOf(v).startsWith(prefix.toLowerCase()));
}

// lang may be a full tag (en-GB) or just a language (it). An exact regional match wins,
// then local (offline) voices, then the system default.
export function pickVoice(lang, uri) {
  const want = String(lang).replace('_', '-').toLowerCase();
  const list = voicesFor(want.slice(0, 2));
  if (uri) {
    const chosen = list.find((v) => v.voiceURI === uri);
    if (chosen) return chosen;
  }
  const exact = list.filter((v) => langOf(v) === want);
  const pool = exact.length ? exact : list;
  return pool.find((v) => v.localService) || pool.find((v) => v.default) || pool[0] || null;
}

let current = null;

export function stopSpeaking() {
  if (!ttsSupported()) return;
  current = null;
  window.speechSynthesis.cancel();
}

// Resolves 'end' | 'stopped' | 'error'. Never rejects, so callers can await it in a loop.
export function speak(text, { lang = 'it-IT', rate = 0.9, voiceURI = '' } = {}) {
  return new Promise((resolve) => {
    if (!ttsSupported() || !String(text || '').trim()) return resolve('error');
    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) synth.cancel();
    const u = new window.SpeechSynthesisUtterance(String(text));
    u.lang = lang;
    u.rate = rate;
    const v = pickVoice(lang, voiceURI);
    if (v) u.voice = v;
    let finished = false;
    const finish = (r) => {
      if (finished) return;
      finished = true;
      clearTimeout(guard);
      if (current === u) current = null;
      resolve(r);
    };
    // Some iPhone versions never fire onend; this guard stops a playlist from hanging.
    const guard = setTimeout(() => finish('end'), 3000 + (String(text).length * 130) / Math.max(0.4, rate));
    u.onend = () => finish('end');
    u.onerror = (e) => finish(e?.error === 'interrupted' || e?.error === 'canceled' ? 'stopped' : 'error');
    current = u;
    synth.speak(u);
  });
}

// Call once from a tap so later automatic playback is allowed on iPhone.
export function unlockSpeech() {
  if (!ttsSupported()) return;
  try {
    const u = new window.SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}
