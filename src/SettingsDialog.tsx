import { useState } from 'react';
import type { BoardSide, GameSettings } from './types';
import Icon from './Icon';
import InstallHelp from './InstallHelp';
import Modal from './Modal';

const levels = [
  { ageGroup: '5-6', label: 'Early reader', duration: 180, wordCount: 6, gridSize: 8 },
  { ageGroup: '7-8', label: 'Word explorer', duration: 180, wordCount: 8, gridSize: 10 },
  { ageGroup: '9-10', label: 'Puzzle pro', duration: 240, wordCount: 10, gridSize: 12 },
  { ageGroup: '11-12', label: 'Brain booster', duration: 300, wordCount: 12, gridSize: 14 },
  { ageGroup: '13+', label: 'Word master', duration: 360, wordCount: 14, gridSize: 16 },
] as const;
const durations = [60, 120, 180, 240, 300, 360];
const counts = [6, 8, 10, 12, 14];
const sizes = [8, 10, 12, 14, 16];
const settingsKey = 'glowwords.challenge.v1';
const mutedKey = 'glowwords.muted';
const boardSideKey = 'glowwords.landscapeBoardSide';

export function readSettings(): GameSettings {
  try {
    const value = JSON.parse(localStorage.getItem(settingsKey) ?? 'null');
    if (value && levels.some(level => level.ageGroup === value.ageGroup) && durations.includes(value.duration)
      && counts.includes(value.wordCount) && sizes.includes(value.gridSize)) return value;
  } catch { /* Use defaults if local storage is unavailable. */ }
  return levels[1];
}

export function readMuted() {
  try { return localStorage.getItem(mutedKey) === 'true'; } catch { return false; }
}

export function readBoardSide(): BoardSide {
  try { return localStorage.getItem(boardSideKey) === 'left' ? 'left' : 'right'; } catch { return 'right'; }
}

export function saveBoardSide(side: BoardSide) {
  try { localStorage.setItem(boardSideKey, side); } catch { /* Session settings still work. */ }
}

export function saveSettings(settings: GameSettings) {
  try { localStorage.setItem(settingsKey, JSON.stringify(settings)); } catch { /* Session settings still work. */ }
}

export function saveMuted(muted: boolean) {
  try { localStorage.setItem(mutedKey, String(muted)); } catch { /* Session settings still work. */ }
}

export default function SettingsDialog({ current, installed, boardSide, onBoardSideChange, onStart, onDismiss }: {
  installed: boolean;
  boardSide: BoardSide; onBoardSideChange: (side: BoardSide) => void;
  current: GameSettings; onStart: (settings: GameSettings) => void; onDismiss: () => void;
}) {
  const [draft, setDraft] = useState(current);
  return <Modal titleId="settings-title" onDismiss={onDismiss}>
    <button type="button" className="dialog-close" onClick={onDismiss} aria-label="Close settings"><Icon name="close" /></button>
    <div className="dialog-symbol"><Icon name="settings" /></div>
    <h2 id="settings-title">Puzzle settings</h2>
    <InstallHelp installed={installed} />
    <div className="board-side-setting">
      <label htmlFor="board-side">Landscape board side</label>
      <select id="board-side" value={boardSide} onChange={event => onBoardSideChange(event.target.value as BoardSide)}>
        <option value="left">Left</option>
        <option value="right">Right</option>
      </select>
    </div>
    <p>Choose a challenge for your next word search.</p>
    <form onSubmit={event => { event.preventDefault(); onStart(draft); }}>
      <div className="setting-field">
        <label htmlFor="reading-level">Reading level</label>
        <select id="reading-level" value={draft.ageGroup} onChange={event => setDraft(levels.find(level => level.ageGroup === event.target.value)!)}>
          {levels.map(level => <option key={level.ageGroup} value={level.ageGroup}>Age {level.ageGroup.replace('-', '–')} · {level.label}</option>)}
        </select>
      </div>
      <div className="tune-grid">
        <div className="setting-field">
          <label htmlFor="round-time">Time</label>
          <select id="round-time" value={draft.duration} onChange={e => setDraft({ ...draft, duration: +e.target.value })}>{durations.map(n => <option key={n} value={n}>{n / 60} min</option>)}</select>
        </div>
        <div className="setting-field">
          <label htmlFor="word-count">Words</label>
          <select id="word-count" value={draft.wordCount} onChange={e => setDraft({ ...draft, wordCount: +e.target.value })}>{counts.map(n => <option key={n}>{n}</option>)}</select>
        </div>
        <div className="setting-field">
          <label htmlFor="grid-size">Grid</label>
          <select id="grid-size" value={draft.gridSize} onChange={e => setDraft({ ...draft, gridSize: +e.target.value })}>{sizes.map(n => <option key={n} value={n}>{n} × {n}</option>)}</select>
        </div>
      </div>
      <button className="primary-button">Start new puzzle <Icon name="arrow" /></button>
    </form>
    <button type="button" className="quiet-button" onClick={onDismiss}>Back to current puzzle</button>
  </Modal>;
}
