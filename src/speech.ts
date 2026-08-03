import { isSilkBrowser } from './browser';

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

let fallbackModule: Promise<typeof import('./fallbackSpeech')> | null = null;
let speechRequest = 0;

function getFallbackModule() {
  fallbackModule ??= import('./fallbackSpeech').catch((error: unknown) => {
    fallbackModule = null;
    throw error;
  });
  return fallbackModule;
}

function needsFallbackSynthesizer(): boolean {
  return isSilkBrowser()
    || !('speechSynthesis' in window)
    || !('SpeechSynthesisUtterance' in window);
}

if (typeof window !== 'undefined' && isSilkBrowser()) {
  void getFallbackModule()
    .then(({ prepareFallback }) => prepareFallback())
    .catch((error: unknown) => console.warn('Fallback speech could not be prepared', error));
}

export function cancelSpeech() {
  speechRequest += 1;
  if (fallbackModule) {
    void fallbackModule
      .then(({ stopFallback }) => stopFallback())
      .catch(() => undefined);
  }

  if (window.GlowWordsNativeSpeech) {
    window.GlowWordsNativeSpeech.cancel();
    return;
  }

  window.speechSynthesis?.cancel();
}

export function speakParts(parts: SpeechPart[]) {
  cancelSpeech();
  const request = speechRequest;

  if (window.GlowWordsNativeSpeech) {
    parts.forEach(({ text, rate = 1, pitch = 1 }) => {
      window.GlowWordsNativeSpeech?.speak(text, rate, pitch);
    });
    return;
  }

  if (needsFallbackSynthesizer()) {
    void getFallbackModule()
      .then(({ speakFallback }) => speakFallback(parts, () => request === speechRequest))
      .catch((error: unknown) => console.warn('Fallback speech is unavailable', error));
    return;
  }

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
