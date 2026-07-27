import { useEffect, useMemo, useRef, useState } from 'react';
import './wordPractice.css';

type PracticeStatus = 'idle' | 'listening' | 'retry' | 'success' | 'unavailable';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    webkitAudioContext?: typeof AudioContext;
  }
}

interface WordPracticeDialogProps {
  word: string;
  muted: boolean;
  onComplete: (bonusSeconds: number) => void;
}

const CELEBRATION_MS = 2600;

function normalizeWord(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, '');
}

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function canPracticeSpeaking(): boolean {
  return Boolean(
    typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && getRecognitionConstructor()
    && 'MediaRecorder' in window
    && navigator.mediaDevices
    && typeof navigator.mediaDevices.getUserMedia === 'function',
  );
}

function speak(text: string, rate = 0.8) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = rate;
  utterance.pitch = 1.08;
  window.speechSynthesis.speak(utterance);
}

function playCelebrationSound() {
  try {
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const gain = context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.05);

    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index % 2 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      const start = context.currentTime + index * 0.16;
      oscillator.start(start);
      oscillator.stop(start + 0.34);
    });

    window.setTimeout(() => void context.close(), 1400);
  } catch {
    // Celebration audio is decorative; the reward never depends on it.
  }
}

export default function WordPracticeDialog({
  word,
  muted,
  onComplete,
}: WordPracticeDialogProps) {
  const [status, setStatus] = useState<PracticeStatus>('idle');
  const [heard, setHeard] = useState('');
  const [practicedByListening, setPracticedByListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finishingRef = useRef(false);
  const recordingSupported = useMemo(canPracticeSpeaking, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (status !== 'success') return;
    if (!muted) playCelebrationSound();
    const timeout = window.setTimeout(() => onComplete(20), CELEBRATION_MS);
    return () => window.clearTimeout(timeout);
  }, [muted, onComplete, status]);

  const readLetter = (letter: string) => {
    if (status === 'success') return;
    speak(letter, 0.65);
  };

  const readWord = () => {
    if (status === 'success') return;
    setPracticedByListening(true);
    speak(word.toLowerCase(), 0.72);
  };

  const finishListening = (nextStatus: PracticeStatus) => {
    recognitionRef.current = null;
    finishingRef.current = false;
    setStatus((current) => current === 'success' ? current : nextStatus);
  };

  const tryWord = async () => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition || status === 'listening' || status === 'success') return;

    window.speechSynthesis?.cancel();
    setHeard('');
    setStatus('listening');
    finishingRef.current = false;

    try {
      // Ask for microphone permission explicitly so unavailable/denied access can
      // be explained before starting the browser's recognition service.
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach((track) => track.stop());

      const recognition = new Recognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 5;
      recognitionRef.current = recognition;

      recognition.onresult = (event) => {
        const alternatives = Array.from(
          { length: event.results[0]?.length ?? 0 },
          (_, index) => event.results[0][index]?.transcript ?? '',
        ).filter(Boolean);
        const match = alternatives.some((alternative) => normalizeWord(alternative) === normalizeWord(word));
        setHeard(alternatives[0] ?? '');
        finishingRef.current = true;
        if (match) {
          setStatus('success');
        } else {
          finishListening('retry');
        }
      };

      recognition.onerror = (event) => {
        finishingRef.current = true;
        finishListening(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'unavailable' : 'retry');
      };

      recognition.onend = () => {
        if (!finishingRef.current) finishListening('retry');
      };

      recognition.start();
    } catch {
      finishListening('unavailable');
    }
  };

  const returnToGame = () => {
    if (status === 'listening' || status === 'success') return;
    onComplete(practicedByListening ? 10 : 0);
  };

  const message = status === 'listening'
    ? 'Listening… say the word now!'
    : status === 'retry'
      ? heard
        ? `I heard “${heard}”. Let’s try once more!`
        : 'I didn’t catch that. Let’s try once more!'
      : status === 'unavailable'
        ? 'The microphone isn’t available, but you can still listen and practice.'
        : 'Tap each letter, hear the whole word, or try saying it yourself.';

  return (
    <div className="practice-backdrop" role="presentation">
      <section
        className={`practice-card ${status === 'success' ? 'practice-success' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="practice-title"
        aria-describedby="practice-message"
      >
        {status === 'success' && (
          <div className="practice-party" aria-hidden="true">
            {Array.from({ length: 32 }, (_, index) => <i key={index} />)}
          </div>
        )}

        {status !== 'success' && (
          <button className="practice-close" type="button" onClick={returnToGame} aria-label="Return to game">
            ×
          </button>
        )}

        <div className="practice-mascot" aria-hidden="true">
          {status === 'success' ? '🎉' : status === 'listening' ? '👂' : '✨'}
        </div>
        <span className="practice-eyebrow">
          {status === 'success' ? 'Super speaking!' : 'Word practice'}
        </span>
        <h2 id="practice-title">
          {status === 'success' ? 'You said it!' : 'Let’s explore this word'}
        </h2>

        {status === 'success' ? (
          <>
            <div className="practice-success-word">{word}</div>
            <p id="practice-message">Amazing job! You earned <strong>20 bonus seconds.</strong></p>
            <div className="practice-bonus" aria-label="Twenty bonus seconds">+20</div>
          </>
        ) : (
          <>
            <div className="practice-letters" aria-label={`Spell ${word.toLowerCase()}`}>
              {word.split('').map((letter, index) => (
                <button
                  key={`${letter}-${index}`}
                  type="button"
                  onClick={() => readLetter(letter)}
                  aria-label={`Hear the letter ${letter}`}
                >
                  {letter}
                </button>
              ))}
            </div>

            <p id="practice-message" className={`practice-message practice-message-${status}`} aria-live="polite">
              {message}
            </p>

            <div className="practice-actions">
              <button className="practice-listen" type="button" onClick={readWord}>
                <span aria-hidden="true">🔊</span>
                <span><strong>Hear the word</strong><small>Listen and say it out loud</small></span>
              </button>

              {recordingSupported && status !== 'unavailable' && (
                <button
                  className={`practice-record ${status === 'listening' ? 'is-listening' : ''}`}
                  type="button"
                  onClick={tryWord}
                  disabled={status === 'listening'}
                >
                  <span className="record-dot" aria-hidden="true">●</span>
                  <span><strong>{status === 'listening' ? 'Listening…' : 'Try it yourself'}</strong><small>Say “{word.toLowerCase()}”</small></span>
                </button>
              )}
            </div>

            <button className="practice-return" type="button" onClick={returnToGame}>
              Return to game{practicedByListening ? ' · +10 seconds' : ''}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
