import meSpeak from 'mespeak';
import config from 'mespeak/src/mespeak_config.json';
import englishVoice from 'mespeak/voices/en/en-us.json';
import type { SpeechPart } from './speech';

let initialized = false;
let activeAudio: HTMLAudioElement | null = null;
let activeUrl: string | null = null;
let finishActive: (() => void) | null = null;

function initialize() {
  if (initialized) return;
  meSpeak.loadConfig(config);
  meSpeak.loadVoice(englishVoice);
  initialized = true;
}

export function prepareFallback() {
  initialize();
}

function speakPart({ text, rate = 1, pitch = 1 }: SpeechPart): Promise<void> {
  const wav = meSpeak.speak(text, {
    amplitude: 90,
    pitch: Math.round(50 * pitch),
    rawdata: true,
    speed: Math.round(175 * rate),
  });
  if (!(wav instanceof ArrayBuffer)) return Promise.resolve();

  const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
  const audio = new Audio(url);
  activeAudio = audio;
  activeUrl = url;

  return new Promise((resolve) => {
    const finish = () => {
      audio.onended = null;
      audio.onerror = null;
      if (activeAudio === audio) activeAudio = null;
      if (activeUrl === url) activeUrl = null;
      if (finishActive === finish) finishActive = null;
      URL.revokeObjectURL(url);
      resolve();
    };
    finishActive = finish;
    audio.onended = finish;
    audio.onerror = finish;
    void audio.play().catch(finish);
  });
}

export async function speakFallback(parts: SpeechPart[], isCurrent: () => boolean) {
  initialize();
  for (const part of parts) {
    if (!isCurrent()) return;
    await speakPart(part);
  }
}

export function stopFallback() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.removeAttribute('src');
    activeAudio.load();
  }
  finishActive?.();
}
