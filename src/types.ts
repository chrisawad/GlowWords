export type AgeGroup = '5-6' | '7-8' | '9-10' | '11-12' | '13+';

export interface GameSettings {
  ageGroup: AgeGroup;
  duration: number;
  wordCount: number;
  gridSize: number;
}

export interface Position {
  row: number;
  col: number;
}

export interface PlacedWord {
  word: string;
  cells: Position[];
}

export interface Puzzle {
  grid: string[][];
  placedWords: PlacedWord[];
}

export interface FoundWord {
  word: string;
  color: string;
  cells: Position[];
}
