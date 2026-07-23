import type { Position, Puzzle } from './types';

const DIRECTIONS = [
  [0, 1], [1, 0], [1, 1], [1, -1],
  [0, -1], [-1, 0], [-1, -1], [-1, 1],
] as const;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function tryPlace(grid: string[][], word: string): Position[] | null {
  const size = grid.length;
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const [rowStep, colStep] = randomItem(DIRECTIONS);
    const startRow = Math.floor(Math.random() * size);
    const startCol = Math.floor(Math.random() * size);
    const endRow = startRow + rowStep * (word.length - 1);
    const endCol = startCol + colStep * (word.length - 1);
    if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;

    const cells = Array.from({ length: word.length }, (_, index) => ({
      row: startRow + rowStep * index,
      col: startCol + colStep * index,
    }));
    if (cells.every(({ row, col }, index) => !grid[row][col] || grid[row][col] === word[index])) {
      cells.forEach(({ row, col }, index) => { grid[row][col] = word[index]; });
      return cells;
    }
  }
  return null;
}

export function createPuzzle(words: string[], size: number): Puzzle {
  // Rebuild a few times when a dense randomized layout gets unlucky.
  let best: Puzzle = { grid: [], placedWords: [] };
  for (let boardAttempt = 0; boardAttempt < 20; boardAttempt += 1) {
    const grid = Array.from({ length: size }, () => Array<string>(size).fill(''));
    const placedWords = [...words]
      .sort((a, b) => b.length - a.length)
      .map((word) => ({ word, cells: tryPlace(grid, word) }))
      .filter((entry): entry is { word: string; cells: Position[] } => Boolean(entry.cells));

    if (placedWords.length > best.placedWords.length) best = { grid, placedWords };
    if (placedWords.length === words.length) break;
  }

  best.grid.forEach((row) => row.forEach((letter, col) => {
    if (!letter) row[col] = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }));
  return best;
}

export function cellsBetween(start: Position, end: Position): Position[] {
  const rowDistance = end.row - start.row;
  const colDistance = end.col - start.col;
  const diagonal = Math.abs(rowDistance) === Math.abs(colDistance);
  const straight = rowDistance === 0 || colDistance === 0;
  if (!diagonal && !straight) return [start];

  const length = Math.max(Math.abs(rowDistance), Math.abs(colDistance)) + 1;
  const rowStep = Math.sign(rowDistance);
  const colStep = Math.sign(colDistance);
  return Array.from({ length }, (_, index) => ({
    row: start.row + rowStep * index,
    col: start.col + colStep * index,
  }));
}

export function cellKey(position: Position): string {
  return `${position.row}-${position.col}`;
}
