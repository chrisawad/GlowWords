import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import Board from './Board';
import Icon from './Icon';
import InstallDialog, { useInstall } from './InstallDialog';
import Modal from './Modal';
import SettingsDialog, { readBoardSide, readMuted, readSettings, saveBoardSide, saveMuted, saveSettings } from './SettingsDialog';
import ShareDialog, { gameUrl } from './ShareDialog';
import WordPracticeDialog from './WordPracticeDialog';
import { createWinCelebration } from './celebration';
import { createPuzzle } from './puzzle';
import { cancelSpeech, speakAndSpellWord } from './speech';
import type { BoardSide, FoundWord, GameSettings, PlacedWord, Puzzle } from './types';
import { createWinAudio } from './winAudio';
import { getWords } from './words';

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function playEndTone() {
  try {
    const Audio = window.AudioContext ?? window.webkitAudioContext;
    if (!Audio) return;
    const context = new Audio();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain).connect(context.destination);
    oscillator.frequency.setValueAtTime(330, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(220, context.currentTime + .16);
    gain.gain.setValueAtTime(.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .22);
    oscillator.onended = () => { void context.close(); };
    oscillator.start();
    oscillator.stop(context.currentTime + .23);
  } catch { /* Audio is optional. */ }
}

function WinConfetti() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const celebration = createWinCelebration(canvas.current!);
    celebration.play();
    return celebration.stop;
  }, []);
  return <canvas ref={canvas} className="win-confetti" aria-hidden="true" />;
}

interface RoundProps {
  settings: GameSettings;
  boardSide: BoardSide;
  onBoardSideChange: (side: BoardSide) => void;
  muted: boolean;
  toggleSound: () => void;
  newRound: (settings: GameSettings) => void;
  install: ReturnType<typeof useInstall>;
}

function Round({ settings, boardSide, onBoardSideChange, muted, toggleSound, newRound, install }: RoundProps) {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [found, setFound] = useState<FoundWord[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [panel, setPanel] = useState<'settings' | 'install' | 'install-offer' | 'sharing' | 'share-link' | null>(null);
  const [practice, setPractice] = useState<PlacedWord | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const winAudio = useMemo(createWinAudio, []);
  const audioContext = useRef<AudioContext | null>(null);
  const timeLeft = Math.max(0, settings.duration + bonus - elapsed);
  const won = Boolean(puzzle && found.length > 0 && found.length === puzzle.placedWords.length);
  const ended = won || timeLeft === 0;

  const { skipOffer, shouldOffer, rememberOffer } = install;
  useEffect(() => {
    if (panel === 'install-offer' && skipOffer) {
      setPanel(null);
    } else if (shouldOffer && puzzle && !panel && !practice && !ended) {
      rememberOffer();
      setPanel('install-offer');
    }
  }, [panel, skipOffer, shouldOffer, rememberOffer, puzzle, practice, ended]);

  useEffect(() => {
    let active = true;
    getWords(settings).then(({ words }) => { if (active) setPuzzle(createPuzzle(words, settings.gridSize)); });
    return () => { active = false; };
  }, [settings]);

  useEffect(() => () => {
    cancelSpeech();
    winAudio.stop();
    if (audioContext.current) void audioContext.current.close();
  }, [winAudio]);

  useEffect(() => {
    if (!puzzle || ended || panel || practice) return;
    const timer = window.setInterval(() => setElapsed(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [puzzle, ended, panel, practice]);

  const timeExpired = timeLeft === 0 && !won;
  useEffect(() => {
    if (timeExpired && !muted) playEndTone();
    // Play once at the moment the clock expires.
  }, [timeExpired]);

  const addFound = (item: FoundWord) => {
    if (!puzzle || ended || found.some(match => match.word === item.word)) return;
    setFound([...found, item]);
    if (muted) return;
    const readWord = () => speakAndSpellWord(item.word);
    const Audio = window.AudioContext ?? window.webkitAudioContext;
    if (found.length + 1 < puzzle.placedWords.length || !Audio) return readWord();
    cancelSpeech();
    try {
      const context = audioContext.current ??= new Audio();
      void winAudio.play(context, readWord);
    } catch { readWord(); }
  };

  const finishPractice = useCallback((seconds: number) => {
    setBonus(value => value + seconds);
    setPractice(null);
  }, []);
  const openPanel = (next: 'settings' | 'install' | 'sharing' | 'share-link') => {
    if (next === 'install') rememberOffer();
    cancelSpeech();
    winAudio.stop();
    setPanel(next);
  };
  const shareGame = async () => {
    if (panel) return;
    if (!navigator.share) {
      openPanel('share-link');
      return;
    }
    openPanel('sharing');
    try {
      await navigator.share({ title: 'Glow Words', url: gameUrl });
      setPanel(current => current === 'sharing' ? null : current);
    } catch (error) {
      const next = error instanceof DOMException && error.name === 'AbortError' ? null : 'share-link';
      setPanel(current => current === 'sharing' ? next : current);
    }
  };
  const closeResult = () => { cancelSpeech(); winAudio.stop(); setReviewing(true); };
  const total = puzzle?.placedWords.length ?? settings.wordCount;

  return <main className="garden" data-board-side={boardSide}>
    <div className="night-sky" aria-hidden="true">{['G', 'W', 'S', 'A'].map(letter => <i key={letter}>{letter}</i>)}</div>
    <header className="game-header" inert={Boolean(practice)}>
      <div className="brand"><img src={`${import.meta.env.BASE_URL}icons/glow-192.png`} alt="" /><h1>Glow <span>Words</span></h1></div>
      <div className="hud">
        <div className={`timer ${timeLeft <= 30 && !won ? 'urgent' : ''}`} aria-label={`${formatTime(timeLeft)} remaining`}>
          <Icon name="clock" /><strong>{formatTime(timeLeft)}</strong>
        </div>
        <button className="hud-button" onClick={toggleSound} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} title={muted ? 'Turn sound on' : 'Turn sound off'}><Icon name={muted ? 'muted' : 'sound'} /></button>
        <button className="hud-button share-button" onClick={shareGame} aria-label="Share Glow Words" title="Share Glow Words"><Icon name="share" /><span>Share</span></button>
        <button className="hud-button" onClick={() => openPanel('settings')} aria-haspopup="dialog" aria-label="Settings" title="Settings"><Icon name="settings" /></button>
        {!install.installed && <button className="hud-button install-button" onClick={() => openPanel('install')} aria-haspopup="dialog" aria-label="Install Glow Words" title="Install Glow Words"><Icon name="install" /><span>Install</span></button>}
      </div>
    </header>

    <div className="game-content" inert={Boolean(practice)}>
      <section className="board-panel" aria-labelledby="garden-title">
        <div className="board-heading"><h2 id="garden-title"><Icon name="spark" />Letter garden</h2><span>{settings.gridSize} × {settings.gridSize}</span></div>
        {puzzle ? <Board puzzle={puzzle} found={found} onFound={addFound} disabled={ended || Boolean(panel || practice)} />
          : <div className="loading-board" role="status">Hiding your words…</div>}
        {ended && reviewing && <button className="replay-link" onClick={() => newRound(settings)}>Play another puzzle <Icon name="arrow" /></button>}
      </section>

      <section className="trail-panel" aria-labelledby="trail-title">
        <div className="trail-art" aria-hidden="true"></div>
        <div className="trail-body">
          <div className="trail-heading"><h2 id="trail-title">Word trail</h2>
            <span className="count" aria-label={`${found.length} of ${total} words found`}>{found.length} / {total}</span>
            <button className="trail-toggle" onClick={() => setListCollapsed(!listCollapsed)} aria-label={listCollapsed ? 'Expand word list' : 'Collapse word list'} aria-expanded={!listCollapsed} aria-controls="trail-list"><Icon name="list" /></button>
          </div>
          <progress value={found.length} max={total} aria-label="Words found" />
          {!listCollapsed && <div id="trail-list">
            <ul className="word-chips">{puzzle?.placedWords.map((word, i) => {
              const match = found.find(item => item.word === word.word);
              return <li key={word.word}><button className={match ? 'found-word' : ''} disabled={ended}
                style={{ '--chip-color': match?.color ?? ['#a18af6', '#f2aa64', '#68c9aa', '#88aee7'][i % 4] } as CSSProperties}
                onClick={() => { cancelSpeech(); setPractice(word); }} aria-label={`Pause and practice ${word.word.toLowerCase()}`}>
                <span className="word-symbol" aria-hidden="true"><Icon name={match ? 'check' : 'sound'} /></span>{word.word}
              </button></li>;
            })}</ul>
            <p className="practice-tip"><Icon name="sound" />Tap a word to hear it or say it aloud.</p>
          </div>}
        </div>
      </section>
    </div>

    {practice && <WordPracticeDialog word={practice.word} acceptedTranscriptions={practice.acceptedTranscriptions} muted={muted} onComplete={finishPractice} />}
    {ended && !reviewing && <Modal titleId="result-title" className="result-dialog" onDismiss={closeResult}>
      {won && <WinConfetti />}
      <button className="dialog-close" onClick={closeResult} aria-label="Review finished puzzle"><Icon name="close" /></button>
      <div className="trophy" aria-hidden="true">{won ? '🏆' : '⏳'}</div>
      <h2 id="result-title">{won ? 'You found every spark!' : 'Time’s up!'}</h2>
      <p>{won ? 'Every word in the garden is glowing.' : 'Here’s how far you got on the word trail.'}</p>
      <div className="result-stats"><div><strong>{found.length} / {total}</strong>Words found</div><div><strong>{formatTime(elapsed)}</strong>Time used</div></div>
      <button className="primary-button" onClick={() => newRound(settings)}>Play another puzzle <Icon name="arrow" /></button>
      <button className="quiet-button" onClick={() => { closeResult(); openPanel('settings'); }}>Change my challenge</button>
    </Modal>}
    {panel === 'settings' && <SettingsDialog current={settings} boardSide={boardSide} onBoardSideChange={onBoardSideChange}
      onStart={newRound} onDismiss={() => setPanel(null)} />}
    {panel === 'share-link' && <ShareDialog onDismiss={() => setPanel(null)} />}
    {(panel === 'install' || panel === 'install-offer') && <InstallDialog install={install}
      automatic={panel === 'install-offer'} onDismiss={() => setPanel(null)} />}
  </main>;
}

export default function App() {
  const [settings, setSettings] = useState(readSettings);
  const [round, setRound] = useState(0);
  const [muted, setMuted] = useState(readMuted);
  const [boardSide, setBoardSide] = useState(readBoardSide);
  const install = useInstall();
  const newRound = (next: GameSettings) => {
    saveSettings(next);
    setSettings(next);
    setRound(value => value + 1);
  };
  const toggleSound = () => {
    if (!muted) cancelSpeech();
    saveMuted(!muted);
    setMuted(!muted);
  };
  const changeBoardSide = (side: BoardSide) => {
    saveBoardSide(side);
    setBoardSide(side);
  };
  return <Round key={round} settings={settings} newRound={newRound} boardSide={boardSide} onBoardSideChange={changeBoardSide}
    muted={muted} toggleSound={toggleSound} install={install} />;
}
