import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { cellKey, cellsBetween, createPuzzle } from './puzzle';
import { getWords } from './words';
import type { AgeGroup, FoundWord, GameSettings, Position, Puzzle } from './types';
import WordPracticeDialog from './WordPracticeDialog';

const AGE_OPTIONS: { id: AgeGroup; label: string; level: string; emoji: string; defaults: Omit<GameSettings, 'ageGroup'> }[] = [
  { id: '5-6', label: '5–6', level: 'Early reader', emoji: '🌱', defaults: { duration: 180, wordCount: 6, gridSize: 8 } },
  { id: '7-8', label: '7–8', level: 'Word explorer', emoji: '🐛', defaults: { duration: 180, wordCount: 8, gridSize: 10 } },
  { id: '9-10', label: '9–10', level: 'Puzzle pro', emoji: '🪁', defaults: { duration: 240, wordCount: 10, gridSize: 12 } },
  { id: '11-12', label: '11–12', level: 'Brain booster', emoji: '🚀', defaults: { duration: 300, wordCount: 12, gridSize: 14 } },
  { id: '13+', label: '13+', level: 'Word master', emoji: '✨', defaults: { duration: 360, wordCount: 14, gridSize: 16 } },
];

const COLORS = ['#ff4f87', '#11c9a5', '#ffb000', '#7957ff', '#00a8e8', '#ef5ad7', '#75c92f'];
const DURATION_OPTIONS = [60, 120, 180, 240, 300, 360];
const GRID_OPTIONS = [8, 10, 12, 14, 16];
const WORD_OPTIONS = [6, 8, 10, 12, 14];

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function playEndTone() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(330, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(220, context.currentTime + 0.16);
    gain.gain.setValueAtTime(0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.23);
  } catch {
    // Audio is decorative; gameplay never depends on it.
  }
}

function speakAndSpellWord(word: string) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;

  window.speechSynthesis.cancel();
  const parts = [word.toLowerCase(), ...word.toUpperCase(), word.toLowerCase()];

  parts.forEach((part, index) => {
    const utterance = new SpeechSynthesisUtterance(part);
    utterance.lang = 'en-US';
    utterance.rate = index > 0 && index < parts.length - 1 ? 1 : 0.85;
    window.speechSynthesis.speak(utterance);
  });
}

function Sparkles() {
  return <div className="sparkles" aria-hidden="true">{Array.from({ length: 20 }, (_, i) => <i key={i} />)}</div>;
}

function SetupScreen({ onStart }: { onStart: (settings: GameSettings) => void }) {
  const [settings, setSettings] = useState<GameSettings>({ ageGroup: '7-8', ...AGE_OPTIONS[1].defaults });

  const chooseAge = (option: typeof AGE_OPTIONS[number]) => {
    setSettings({ ageGroup: option.id, ...option.defaults });
  };

  const start = () => onStart(settings);

  return (
    <main className="setup-shell">
      <Sparkles />
      <nav className="brand-bar" aria-label="Glow Words">
        <div className="brand-mark" aria-hidden="true">G</div>
        <div><strong>Glow Words</strong><span>Find your spark</span></div>
      </nav>

      <section className="setup-layout">
        <div className="welcome-panel">
          <div className="eyebrow"><span>✦</span> A little adventure in every word</div>
          <h1>Ready, set,<br /><em>find!</em></h1>
          <p>Race the clock, uncover hidden words, and make the whole board glow.</p>
          <div className="hero-art" role="img" aria-label="A cheerful firefly exploring a magical garden of letters">
            <img src={`${import.meta.env.BASE_URL}assets/letter-garden.webp`} alt="" />
            <div className="art-sticker">Can you find<br /><strong>them all?</strong></div>
            <div className="hero-palette" aria-hidden="true"><i /><i /><i /><span>Glow garden</span></div>
          </div>
        </div>

        <div className="setup-card">
          <div className="step-heading"><span>1</span><div><h2>Choose your explorer</h2><p>We’ll match words to their level.</p></div></div>
          <div className="age-grid">
            {AGE_OPTIONS.map((option) => (
              <button
                key={option.id}
                className={`age-option ${settings.ageGroup === option.id ? 'selected' : ''}`}
                onClick={() => chooseAge(option)}
                aria-pressed={settings.ageGroup === option.id}
              >
                <span className="age-emoji">{option.emoji}</span>
                <strong>Age {option.label}</strong>
                <small>{option.level}</small>
                <i aria-hidden="true">✓</i>
              </button>
            ))}
          </div>

          <div className="dotted-line" />
          <div className="step-heading compact"><span>2</span><div><h2>Tune your challenge</h2><p>Age-friendly defaults are ready—or mix it up!</p></div></div>
          <div className="tune-grid">
            <label>
              <b><span aria-hidden="true">⏱</span> Time</b>
              <select value={settings.duration} onChange={(event) => setSettings({ ...settings, duration: Number(event.target.value) })}>
                {DURATION_OPTIONS.map((value) => <option key={value} value={value}>{value / 60} {value === 60 ? 'minute' : 'minutes'}</option>)}
              </select>
            </label>
            <label>
              <b><span aria-hidden="true">☷</span> Words</b>
              <select value={settings.wordCount} onChange={(event) => setSettings({ ...settings, wordCount: Number(event.target.value) })}>
                {WORD_OPTIONS.map((value) => <option key={value} value={value}>{value} words</option>)}
              </select>
            </label>
            <label>
              <b><span aria-hidden="true">▦</span> Grid</b>
              <select value={settings.gridSize} onChange={(event) => setSettings({ ...settings, gridSize: Number(event.target.value) })}>
                {GRID_OPTIONS.map((value) => <option key={value} value={value}>{value} × {value}</option>)}
              </select>
            </label>
          </div>

          <button className="start-button" onClick={start}><span>Start exploring</span><b aria-hidden="true">→</b></button>
          <p className="touch-hint"><span aria-hidden="true">☝</span> Drag across letters with your finger or mouse</p>
        </div>
      </section>
    </main>
  );
}

interface BoardProps {
  puzzle: Puzzle;
  found: FoundWord[];
  onFound: (found: FoundWord) => void;
  disabled: boolean;
  muted: boolean;
}

function Board({ puzzle, found, onFound, disabled, muted }: BoardProps) {
  const [selection, setSelection] = useState<Position[]>([]);
  const [dragging, setDragging] = useState(false);
  const [miss, setMiss] = useState(false);
  const pointerId = useRef<number | null>(null);
  const startCell = useRef<Position | null>(null);

  const foundByCell = useMemo(() => {
    const map = new Map<string, string>();
    found.forEach((item) => item.cells.forEach((cell) => map.set(cellKey(cell), item.color)));
    return map;
  }, [found]);

  const updateEnd = useCallback((position: Position) => {
    if (!startCell.current) return;
    setSelection(cellsBetween(startCell.current, position));
  }, []);

  const begin = (event: ReactPointerEvent, position: Position) => {
    if (disabled) return;
    event.preventDefault();
    pointerId.current = event.pointerId;
    startCell.current = position;
    setSelection([position]);
    setDragging(true);
    setMiss(false);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const move = (event: ReactPointerEvent) => {
    if (!dragging || event.pointerId !== pointerId.current) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-cell]');
    if (!target) return;
    updateEnd({ row: Number(target.dataset.row), col: Number(target.dataset.col) });
  };

  const finish = (event: ReactPointerEvent) => {
    if (!dragging || event.pointerId !== pointerId.current) return;
    const letters = selection.map(({ row, col }) => puzzle.grid[row][col]).join('');
    const reverse = [...letters].reverse().join('');
    const placed = puzzle.placedWords.find(({ word }) => (word === letters || word === reverse) && !found.some((item) => item.word === word));
    if (placed) {
      const used = new Set(found.map((item) => item.color));
      const available = COLORS.filter((color) => !used.has(color));
      const color = (available.length ? available : COLORS)[Math.floor(Math.random() * (available.length || COLORS.length))];
      onFound({ word: placed.word, color, cells: placed.cells });
      if (!muted) speakAndSpellWord(placed.word);
    } else if (selection.length > 1) {
      setMiss(true);
      window.setTimeout(() => setMiss(false), 360);
    }
    setDragging(false);
    setSelection([]);
    startCell.current = null;
    pointerId.current = null;
  };

  const selectedKeys = new Set(selection.map(cellKey));

  return (
    <div
      className={`letter-board ${miss ? 'miss' : ''}`}
      style={{ '--grid-size': puzzle.grid.length } as CSSProperties}
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={finish}
      onContextMenu={(event) => event.preventDefault()}
      role="grid"
      aria-label="Word search letter grid"
    >
      {puzzle.grid.flatMap((row, rowIndex) => row.map((letter, colIndex) => {
        const position = { row: rowIndex, col: colIndex };
        const key = cellKey(position);
        const foundColor = foundByCell.get(key);
        const cellStyle = {
          '--cell-hue': (rowIndex * 41 + colIndex * 53 + 264) % 360,
          '--cell-delay': `${(rowIndex + colIndex) * 12}ms`,
          ...(foundColor ? { '--found-color': foundColor } : {}),
        } as CSSProperties;
        return (
          <div
            key={key}
            className={`letter-cell ${selectedKeys.has(key) ? 'selecting' : ''} ${foundColor ? 'found-cell' : ''}`}
            style={cellStyle}
            data-cell="true"
            data-row={rowIndex}
            data-col={colIndex}
            role="gridcell"
            onPointerDown={(event) => begin(event, position)}
          >
            <span>{letter}</span>
          </div>
        );
      }))}
    </div>
  );
}

function GameScreen({ settings, onHome }: { settings: GameSettings; onHome: () => void }) {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [source, setSource] = useState<'server' | 'offline'>('offline');
  const [found, setFound] = useState<FoundWord[]>([]);
  const [timeLeft, setTimeLeft] = useState(settings.duration);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [round, setRound] = useState(0);
  const [practiceWord, setPracticeWord] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    window.speechSynthesis?.cancel();
    setPuzzle(null);
    setFound([]);
    setEnded(false);
    setTimeLeft(settings.duration);
    setPracticeWord(null);
    getWords(settings).then((result) => {
      if (!active) return;
      const nextPuzzle = createPuzzle(result.words, settings.gridSize);
      setPuzzle(nextPuzzle);
      setSource(result.source);
    });
    return () => { active = false; };
  }, [settings, round]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  useEffect(() => {
    if (!puzzle || ended || practiceWord) return;
    const timer = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setEnded(true);
          if (!muted) playEndTone();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [puzzle, ended, muted, practiceWord]);

  useEffect(() => {
    if (puzzle && found.length === puzzle.placedWords.length && found.length > 0) {
      const timeout = window.setTimeout(() => setEnded(true), 450);
      return () => window.clearTimeout(timeout);
    }
  }, [found.length, puzzle]);

  const addFound = (word: FoundWord) => {
    setFound((current) => current.some((item) => item.word === word.word) ? current : [...current, word]);
  };

  const openPractice = (word: string) => {
    window.speechSynthesis?.cancel();
    setPracticeWord(word);
  };

  const finishPractice = useCallback((bonusSeconds: number) => {
    setTimeLeft((current) => current + bonusSeconds);
    setPracticeWord(null);
  }, []);

  if (!puzzle) {
    return <main className="loading-screen"><div className="loader-orbit"><span>G</span></div><h1>Hiding your words…</h1><p>Sprinkling letters across the board</p></main>;
  }

  const progress = found.length / puzzle.placedWords.length;
  const urgency = timeLeft <= 30;
  const allFound = found.length === puzzle.placedWords.length;

  return (
    <main className="game-shell">
      <div className="game-aurora" aria-hidden="true"><i /><i /><i /><i /></div>
      <header className="game-header">
        <button className="icon-button home-button" onClick={onHome} aria-label="Back to setup">←</button>
        <div className="mini-brand"><span>G</span><strong>Glow Words</strong></div>
        <div className={`timer ${urgency ? 'urgent' : ''}`} aria-label={`${formatTime(timeLeft)} remaining`}><span>⏱</span><strong>{formatTime(timeLeft)}</strong></div>
        <button className="icon-button" onClick={() => setMuted(!muted)} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>{muted ? '🔇' : '🔊'}</button>
      </header>

      <div className="game-content">
        <section className="mission-card">
          <div className="mission-heading">
            <div><span className="eyebrow game-eyebrow">Your word trail</span><h1>Find the hidden words</h1><p>Tap a word to pause the game and practice it.</p></div>
            <div className="score-bubble"><strong>{found.length}</strong><span>of {puzzle.placedWords.length}</span></div>
          </div>
          <div className="progress-track"><i style={{ width: `${progress * 100}%` }} /></div>
          <div className="word-chips">
            {puzzle.placedWords.map(({ word }, index) => {
              const match = found.find((item) => item.word === word);
              const chipStyle = {
                '--chip-hue': (index * 47 + 270) % 360,
                ...(match ? { '--word-color': match.color } : {}),
              } as CSSProperties;
              return (
                <button
                  key={word}
                  type="button"
                  className={match ? 'found-word' : ''}
                  style={chipStyle}
                  onClick={() => openPractice(word)}
                  aria-label={`Pause and practice ${word.toLowerCase()}`}
                  title={`Practice ${word.toLowerCase()}`}
                >
                  <span aria-hidden="true">🔊</span>{match && '✓ '}{word}
                </button>
              );
            })}
          </div>
        </section>

        <section className="board-wrap">
          <div className="board-caption"><span><i /> Swipe a straight line</span><span className="source-note" title="Words are built into the app when the server is unavailable">{source === 'server' ? '● Online words' : '● Offline words'}</span></div>
          <div className="board-stage">
            <Board puzzle={puzzle} found={found} onFound={addFound} disabled={ended || Boolean(practiceWord)} muted={muted} />
          </div>
        </section>
      </div>

      {practiceWord && (
        <WordPracticeDialog
          word={practiceWord}
          muted={muted}
          onComplete={finishPractice}
        />
      )}

      {ended && (
        <div className="result-backdrop" role="dialog" aria-modal="true" aria-labelledby="result-title">
          {allFound && <div className="confetti" aria-hidden="true">{Array.from({ length: 28 }, (_, i) => <i key={i} />)}</div>}
          <div className="result-card">
            <div className="result-orb">{allFound ? '🏆' : found.length ? '✨' : '🌱'}</div>
            <span className="eyebrow">{allFound ? 'Trail complete!' : 'Time’s up!'}</span>
            <h1 id="result-title">{allFound ? 'You found every spark!' : 'Great exploring!'}</h1>
            <p>You uncovered <strong>{found.length} of {puzzle.placedWords.length}</strong> hidden words.</p>
            <div className="result-stats"><div><span>Words found</span><strong>{found.length}</strong></div><div><span>Time used</span><strong>{formatTime(settings.duration - timeLeft)}</strong></div></div>
            <button className="start-button" onClick={() => setRound((value) => value + 1)}><span>Play another board</span><b>↻</b></button>
            <button className="text-button" onClick={onHome}>Change my challenge</button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function App() {
  const [settings, setSettings] = useState<GameSettings | null>(null);
  return settings
    ? <GameScreen settings={settings} onHome={() => setSettings(null)} />
    : <SetupScreen onStart={setSettings} />;
}
