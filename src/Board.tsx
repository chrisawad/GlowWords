import { useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { cellKey, cellsBetween } from './puzzle';
import type { FoundWord, Position, Puzzle } from './types';

const COLORS = ['#ff7599', '#38cbb2', '#f4bc55', '#a590f9', '#79cbed', '#e78ddb', '#a3ce6c'];

interface BoardProps {
  puzzle: Puzzle;
  found: FoundWord[];
  onFound: (found: FoundWord) => void;
  disabled: boolean;
}

export default function Board({ puzzle, found, onFound, disabled }: BoardProps) {
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
    if (disabled || pointerId.current !== null) return;
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
      onFound({ word: placed.word, color, cells: selection });
    } else if (selection.length > 1) {
      setMiss(true);
      window.setTimeout(() => setMiss(false), 360);
    }
    clearSelection();
  };

  const clearSelection = () => {
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
      onPointerCancel={event => { if (event.pointerId === pointerId.current) clearSelection(); }}
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
