import type { AgeGroup, GameSettings } from './types';

export const WORD_BANKS: Record<AgeGroup, string[]> = {
  '5-6': [
    'CAT', 'DOG', 'SUN', 'MOON', 'FISH', 'BIRD', 'TREE', 'STAR', 'BOOK', 'PLAY',
    'JUMP', 'BLUE', 'RED', 'HAT', 'CAKE', 'FROG', 'DUCK', 'MILK', 'BALL', 'RAIN',
    'BEAR', 'LION', 'HOME', 'KIND', 'HAPPY', 'SMILE', 'GREEN', 'CLOUD', 'APPLE', 'TRAIN',
  ],
  '7-8': [
    'PLANET', 'GARDEN', 'RABBIT', 'ORANGE', 'WINDOW', 'FRIEND', 'PURPLE', 'CASTLE', 'SCHOOL', 'ROCKET',
    'PENCIL', 'TURTLE', 'JUNGLE', 'FLOWER', 'COOKIE', 'BUBBLE', 'KITTEN', 'WINTER', 'SUMMER', 'BRIDGE',
    'MARKET', 'PIRATE', 'DRAGON', 'BRIGHT', 'DOLPHIN', 'RAINBOW', 'MONKEY', 'BUTTON', 'PICNIC', 'THUNDER',
  ],
  '9-10': [
    'ADVENTURE', 'DINOSAUR', 'MOUNTAIN', 'TREASURE', 'CHAMPION', 'NOTEBOOK', 'BASEBALL', 'ELEPHANT', 'DISCOVER', 'HOSPITAL',
    'LANGUAGE', 'SANDWICH', 'CALENDAR', 'VOLCANO', 'BUTTERFLY', 'FESTIVAL', 'FOOTPRINT', 'MARVELOUS', 'INVENTOR', 'TELESCOPE',
    'KEYBOARD', 'WATERFALL', 'SQUIRREL', 'OCTOPUS', 'SURPRISE', 'COURAGE', 'JOURNEY', 'CRYSTAL', 'HARMONY', 'LIBRARY',
  ],
  '11-12': [
    'ATMOSPHERE', 'BIOLOGY', 'CONSTELLATION', 'CREATIVITY', 'EXPERIMENT', 'GEOGRAPHY', 'ILLUSION', 'KNOWLEDGE', 'LABYRINTH', 'MICROSCOPE',
    'NUTRITION', 'OBSERVATORY', 'PHOTOGRAPH', 'QUESTION', 'RESERVOIR', 'SATELLITE', 'TECHNOLOGY', 'UNIVERSE', 'VELOCITY', 'WILDERNESS',
    'ARCHITECT', 'ECOSYSTEM', 'FRACTION', 'HERITAGE', 'JOURNAL', 'MAGNETIC', 'POLLINATE', 'SYMMETRY', 'TRIANGLE', 'VOLUNTEER',
  ],
  '13+': [
    'ALGORITHM', 'BIODIVERSITY', 'CHRONOLOGY', 'DEMOCRACY', 'ENTREPRENEUR', 'FASCINATING', 'GRAVITATION', 'HYPOTHESIS', 'IMAGINATION', 'JOURNALISM',
    'KALEIDOSCOPE', 'LITERATURE', 'METAMORPHOSIS', 'NEUROSCIENCE', 'OPPORTUNITY', 'PHILOSOPHY', 'QUANTITATIVE', 'RENAISSANCE', 'SUSTAINABLE', 'THERMODYNAMICS',
    'UNDERSTANDING', 'VULNERABILITY', 'WAVELENGTH', 'EXPLORATION', 'PERSEVERANCE', 'ARCHAEOLOGY', 'CIRCUMFERENCE', 'EQUILIBRIUM', 'INNOVATION', 'PERSPECTIVE',
  ],
};

const API_TIMEOUT_MS = 2500;

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function cleanWords(words: unknown, maxLength: number): string[] {
  if (!Array.isArray(words)) return [];
  return [...new Set(words
    .filter((word): word is string => typeof word === 'string')
    .map((word) => word.toUpperCase().replace(/[^A-Z]/g, ''))
    .filter((word) => word.length >= 3 && word.length <= maxLength))];
}

/**
 * Server-ready word source. The game first asks /api/words and gracefully uses
 * the bundled age-level vocabulary when that endpoint is not available yet.
 */
export async function getWords(settings: GameSettings): Promise<{ words: string[]; source: 'server' | 'offline' }> {
  const query = new URLSearchParams({
    age: settings.ageGroup,
    gridSize: String(settings.gridSize),
    count: String(settings.wordCount),
  });
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`/api/words?${query}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Word service returned ${response.status}`);
    const data: unknown = await response.json();
    const rawWords = Array.isArray(data) ? data : (data as { words?: unknown })?.words;
    const words = cleanWords(rawWords, settings.gridSize);
    if (words.length < settings.wordCount) throw new Error('Not enough usable server words');
    return { words: shuffle(words).slice(0, settings.wordCount), source: 'server' };
  } catch {
    const fallback = cleanWords(WORD_BANKS[settings.ageGroup], settings.gridSize);
    return { words: shuffle(fallback).slice(0, Math.min(settings.wordCount, fallback.length)), source: 'offline' };
  } finally {
    window.clearTimeout(timeout);
  }
}
