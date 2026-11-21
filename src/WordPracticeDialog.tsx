import { useEffect, useRef, useState } from 'react';
import './wordPractice.css';
import Icon from './Icon';
import { cancelSpeech, speakText } from './speech';

type PracticeStatus = 'idle' | 'preparing' | 'listening' | 'recording' | 'review' | 'retry' | 'success' | 'unavailable';

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
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
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
  acceptedTranscriptions: string[];
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
  acceptedTranscriptions,
  muted,
  onComplete,
}: WordPracticeDialogProps) {
  const [status, setStatus] = useState<PracticeStatus>('idle');
  const [heard, setHeard] = useState('');
  const [micIssue, setMicIssue] = useState('');
  const [practicedByListening, setPracticedByListening] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingUrlRef = useRef<string | null>(null);
  const recordingTimeoutRef = useRef<number | null>(null);
  const activeRef = useRef(true);
  const finishingRef = useRef(false);
  const recognitionSupported = Boolean(getRecognitionConstructor());
  const recordingSupported = typeof MediaRecorder === 'function' && typeof navigator.mediaDevices?.getUserMedia === 'function';
  const canUseMic = window.isSecureContext && (recognitionSupported || recordingSupported);
  const micActive = status === 'preparing' || status === 'listening' || status === 'recording';

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.onstart = null;
        recognition.onaudiostart = null;
        recognition.abort();
      }
      const recorder = mediaRecorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onerror = null;
        recorder.onstop = null;
        if (recorder.state === 'recording') recorder.stop();
      }
      recorder?.stream.getTracks().forEach((track) => track.stop());
      if (recordingTimeoutRef.current !== null) window.clearTimeout(recordingTimeoutRef.current);
      if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
      cancelSpeech();
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
    speakText(letter, 0.65);
  };

  const readWord = () => {
    if (status === 'success') return;
    setPracticedByListening(true);
    speakText(word.toLowerCase(), 0.72);
  };

  const finishListening = (nextStatus: PracticeStatus) => {
    recognitionRef.current = null;
    finishingRef.current = false;
    setStatus((current) => current === 'success' ? current : nextStatus);
  };

  const tryWord = async () => {
    const Recognition = getRecognitionConstructor();
    if (!canUseMic || micActive || status === 'success') return;

    cancelSpeech();
    setHeard('');
    setStatus('preparing');
    finishingRef.current = false;
    let permissionStream: MediaStream | null = null;

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      const stream = permissionStream;
      if (!activeRef.current) {
        stream?.getTracks().forEach((track) => track.stop());
        return;
      }

      if (!Recognition) {
        if (!stream) throw new Error('Microphone unavailable');
        const chunks: Blob[] = [];
        const recorder = new MediaRecorder(stream);
        let failed = false;
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => {
          failed = true;
          stream.getTracks().forEach((track) => track.stop());
          mediaRecorderRef.current = null;
          setStatus('unavailable');
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop());
          mediaRecorderRef.current = null;
          if (recordingTimeoutRef.current !== null) {
            window.clearTimeout(recordingTimeoutRef.current);
            recordingTimeoutRef.current = null;
          }
          if (failed || !activeRef.current) return;
          const recording = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          if (!recording.size) {
            setStatus('unavailable');
            return;
          }
          if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
          recordingUrlRef.current = URL.createObjectURL(recording);
          setRecordingUrl(recordingUrlRef.current);
          setStatus('review');
        };
        recorder.start();
        setStatus('recording');
        recordingTimeoutRef.current = window.setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop();
        }, 5000);
        return;
      }

      // Ask for microphone permission explicitly so unavailable/denied access can
      // be explained before starting the browser's recognition service.
      stream?.getTracks().forEach((track) => track.stop());

      const recognition = new Recognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 5;
      recognitionRef.current = recognition;
      const acceptedSpokenForms = new Set([word, ...acceptedTranscriptions].map(normalizeWord));

      const markListeningReady = () => {
        if (!activeRef.current || recognitionRef.current !== recognition) return;
        setStatus((current) => current === 'preparing' ? 'listening' : current);
      };

      // SpeechRecognition.start() can take a few seconds to activate on Android.
      // Do not invite the user to speak until the browser confirms that its
      // recognition service/audio capture has actually started.
      recognition.onstart = markListeningReady;
      recognition.onaudiostart = markListeningReady;

      recognition.onresult = (event) => {
        if (recognitionRef.current !== recognition) return;
        const alternatives = Array.from(
          { length: event.results[0]?.length ?? 0 },
          (_, index) => event.results[0][index]?.transcript ?? '',
        ).filter(Boolean);
        const match = alternatives.some((alternative) => acceptedSpokenForms.has(normalizeWord(alternative)));
        setHeard(alternatives[0] ?? '');
        finishingRef.current = true;
        if (match) {
          setStatus('success');
        } else {
          finishListening('retry');
        }
      };

      recognition.onerror = (event) => {
        if (recognitionRef.current !== recognition) return;
        finishingRef.current = true;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setMicIssue('Check microphone and speech permissions in your browser, then try again.');
        }
        finishListening(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'unavailable' : 'retry');
      };

      recognition.onend = () => {
        if (recognitionRef.current === recognition && !finishingRef.current) finishListening('retry');
      };

      recognition.start();
    } catch (error) {
      permissionStream?.getTracks().forEach((track) => track.stop());
      if (!activeRef.current) return;
      setMicIssue(error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Allow microphone access in your browser, then try again.'
        : 'Check that a microphone is connected, then try again.');
      finishListening('unavailable');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
  };

  const returnToGame = () => {
    if (status === 'success') return;
    onComplete(practicedByListening ? 10 : 0);
  };

  const message = !window.isSecureContext
    ? 'Listen, then say the word aloud. Open Glow Words over HTTPS to use your microphone.'
    : !canUseMic
    ? 'Listen, then say the word aloud. This browser supports practice without a microphone.'
    : status === 'preparing'
    ? 'Getting the microphone ready… wait for “Go!” before speaking.'
    : status === 'listening'
      ? `Go! Say “${word.toLowerCase()}” now.`
    : status === 'recording'
      ? 'Recording… say the word, then tap stop.'
      : status === 'review'
        ? 'Listen back. If it sounds right, celebrate your practice!'
        : status === 'retry'
          ? heard
            ? `I heard “${heard}”. Let’s try once more!`
            : 'I didn’t catch that. Let’s try once more!'
          : status === 'unavailable'
            ? micIssue || 'The microphone is unavailable. You can listen or try again.'
            : 'Tap a letter to hear it, or practice the whole word.';

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
          {status === 'success' ? '🎉' : status === 'preparing' ? '⏳' : status === 'listening' || status === 'recording' ? '👂' : '✨'}
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
                  disabled={micActive}
                  aria-label={`Hear the letter ${letter}`}
                >
                  {letter}
                </button>
              ))}
            </div>

            <p id="practice-message" className={`practice-message practice-message-${status}`} aria-live="polite">
              {message}
            </p>

            {status === 'review' && recordingUrl && (
              <div className="practice-review">
                <audio controls src={recordingUrl} aria-label="Your word practice recording" />
                <button type="button" onClick={() => setStatus('success')}>That sounded great!</button>
              </div>
            )}

            <div className="practice-actions">
              <button className="practice-listen" type="button" onClick={readWord} disabled={micActive}>
                <span aria-hidden="true">🔊</span>
                <span><strong>Hear the word</strong><small>Listen and say it out loud</small></span>
              </button>

                <button
                  className={`practice-record ${status === 'preparing' ? 'is-preparing' : ''} ${status === 'listening' || status === 'recording' ? 'is-listening' : ''}`}
                  type="button"
                  onClick={status === 'recording' ? stopRecording : tryWord}
                  disabled={!canUseMic || status === 'preparing' || status === 'listening'}
                  aria-describedby="practice-message"
                >
                  <span className="record-dot" aria-hidden="true"><Icon name="mic" /></span>
                  <span>
                    <strong>{status === 'preparing' ? 'Getting ready…' : status === 'listening' ? 'Go! I’m listening' : status === 'recording' ? 'Stop recording' : 'Say the word'}</strong>
                    <small>{!window.isSecureContext ? 'Microphone needs HTTPS' : !canUseMic ? 'Microphone unavailable' : status === 'preparing' ? 'Please wait before speaking' : recognitionSupported ? `Say “${word.toLowerCase()}”` : 'Record and listen back'}</small>
                  </span>
                </button>
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
