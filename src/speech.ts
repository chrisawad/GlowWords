interface NativeSpeechBridge {
  speak(text: string, rate: number, pitch: number): void;
  cancel(): void;
}

declare global {
  interface Window {
    GlowWordsNativeSpeech?: NativeSpeechBridge;
  }
}

export interface SpeechPart {
  text: string;
  rate?: number;
  pitch?: number;
}

export function cancelSpeech() {
  if (window.GlowWordsNativeSpeech) {
    window.GlowWordsNativeSpeech.cancel();
    return;
  }

  window.speechSynthesis?.cancel();
}

export function speakParts(parts: SpeechPart[]) {
  cancelSpeech();

  if (window.GlowWordsNativeSpeech) {
    parts.forEach(({ text, rate = 1, pitch = 1 }) => {
      window.GlowWordsNativeSpeech?.speak(text, rate, pitch);
    });
    return;
  }

  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;

  parts.forEach(({ text, rate = 1, pitch = 1 }) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = rate;
    utterance.pitch = pitch;
    window.speechSynthesis.speak(utterance);
  });
}

export function speakText(text: string, rate = 0.8, pitch = 1.08) {
  speakParts([{ text, rate, pitch }]);
}
