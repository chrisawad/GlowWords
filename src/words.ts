import type { AgeGroup, GameSettings, WordEntry } from './types';

function entry(word: string, ...acceptedTranscriptions: string[]): WordEntry {
  return { word, acceptedTranscriptions: [word, ...acceptedTranscriptions] };
}

export const WORD_BANKS: Record<AgeGroup, WordEntry[]> = {
  '5-6': [
    entry('CAT', 'CATS'), entry('DOG', 'DOGS'), entry('SUN', 'SUNS'), entry('MOON', 'MOONS'), entry('FISH', 'FISHES'),
    entry('BIRD', 'BIRDS'), entry('TREE', 'TREES'), entry('STAR', 'STARS'), entry('BOOK', 'BOOKS'), entry('PLAY', 'PLAYS'),
    entry('JUMP', 'JUMPS'), entry('BLUE'), entry('RED'), entry('HAT', 'HATS'), entry('CAKE', 'CAKES'),
    entry('FROG', 'FROGS'), entry('DUCK', 'DUCKS'), entry('MILK'), entry('BALL', 'BALLS'), entry('RAIN'),
    entry('BEAR', 'BEARS'), entry('LION', 'LIONS'), entry('HOME', 'HOMES'), entry('KIND', 'KINDS'), entry('HAPPY'),
    entry('SMILE', 'SMILES'), entry('GREEN'), entry('CLOUD', 'CLOUDS'), entry('APPLE', 'APPLES'), entry('TRAIN', 'TRAINS'),
  ],
  '7-8': [
    entry('PLANET', 'PLANETS'), entry('GARDEN', 'GARDENS'), entry('RABBIT', 'RABBITS'), entry('ORANGE', 'ORANGES'), entry('WINDOW', 'WINDOWS'),
    entry('FRIEND', 'FRIENDS'), entry('PURPLE'), entry('CASTLE', 'CASTLES'), entry('SCHOOL', 'SCHOOLS'), entry('ROCKET', 'ROCKETS'),
    entry('PENCIL', 'PENCILS'), entry('TURTLE', 'TURTLES'), entry('JUNGLE', 'JUNGLES'), entry('FLOWER', 'FLOWERS'), entry('COOKIE', 'COOKIES'),
    entry('BUBBLE', 'BUBBLES'), entry('KITTEN', 'KITTENS'), entry('WINTER', 'WINTERS'), entry('SUMMER', 'SUMMERS'), entry('BRIDGE', 'BRIDGES'),
    entry('MARKET', 'MARKETS'), entry('PIRATE', 'PIRATES'), entry('DRAGON', 'DRAGONS'), entry('BRIGHT'), entry('DOLPHIN', 'DOLPHINS'),
    entry('RAINBOW', 'RAINBOWS'), entry('MONKEY', 'MONKEYS'), entry('BUTTON', 'BUTTONS'), entry('PICNIC', 'PICNICS'), entry('THUNDER'),
  ],
  '9-10': [
    entry('ADVENTURE', 'ADVENTURES'), entry('DINOSAUR', 'DINOSAURS'), entry('MOUNTAIN', 'MOUNTAINS'), entry('TREASURE', 'TREASURES'), entry('CHAMPION', 'CHAMPIONS'),
    entry('NOTEBOOK', 'NOTEBOOKS'), entry('BASEBALL', 'BASEBALLS'), entry('ELEPHANT', 'ELEPHANTS'), entry('DISCOVER'), entry('HOSPITAL', 'HOSPITALS'),
    entry('LANGUAGE', 'LANGUAGES'), entry('SANDWICH', 'SANDWICHES'), entry('CALENDAR', 'CALENDARS'), entry('VOLCANO', 'VOLCANOES', 'VOLCANOS'), entry('BUTTERFLY', 'BUTTERFLIES'),
    entry('FESTIVAL', 'FESTIVALS'), entry('FOOTPRINT', 'FOOTPRINTS'), entry('MARVELOUS'), entry('INVENTOR', 'INVENTORS'), entry('TELESCOPE', 'TELESCOPES'),
    entry('KEYBOARD', 'KEYBOARDS'), entry('WATERFALL', 'WATERFALLS'), entry('SQUIRREL', 'SQUIRRELS'), entry('OCTOPUS', 'OCTOPUSES'), entry('SURPRISE', 'SURPRISES'),
    entry('COURAGE'), entry('JOURNEY', 'JOURNEYS'), entry('CRYSTAL', 'CRYSTALS'), entry('HARMONY', 'HARMONIES'), entry('LIBRARY', 'LIBRARIES'),
  ],
  '11-12': [
    entry('ATMOSPHERE', 'ATMOSPHERES'), entry('BIOLOGY', 'BIOLOGIES'), entry('CONSTELLATION', 'CONSTELLATIONS'), entry('CREATIVITY', 'CREATIVITIES'), entry('EXPERIMENT', 'EXPERIMENTS'),
    entry('GEOGRAPHY', 'GEOGRAPHIES'), entry('ILLUSION', 'ILLUSIONS'), entry('KNOWLEDGE'), entry('LABYRINTH', 'LABYRINTHS'), entry('MICROSCOPE', 'MICROSCOPES'),
    entry('NUTRITION'), entry('OBSERVATORY', 'OBSERVATORIES'), entry('PHOTOGRAPH', 'PHOTOGRAPHS'), entry('QUESTION', 'QUESTIONS'), entry('RESERVOIR', 'RESERVOIRS'),
    entry('SATELLITE', 'SATELLITES'), entry('TECHNOLOGY', 'TECHNOLOGIES'), entry('UNIVERSE', 'UNIVERSES'), entry('VELOCITY', 'VELOCITIES'), entry('WILDERNESS', 'WILDERNESSES'),
    entry('ARCHITECT', 'ARCHITECTS'), entry('ECOSYSTEM', 'ECOSYSTEMS'), entry('FRACTION', 'FRACTIONS'), entry('HERITAGE', 'HERITAGES'), entry('JOURNAL', 'JOURNALS'),
    entry('MAGNETIC'), entry('POLLINATE'), entry('SYMMETRY', 'SYMMETRIES'), entry('TRIANGLE', 'TRIANGLES'), entry('VOLUNTEER', 'VOLUNTEERS'),
  ],
  '13+': [
    entry('ALGORITHM', 'ALGORITHMS'), entry('BIODIVERSITY', 'BIODIVERSITIES'), entry('CHRONOLOGY', 'CHRONOLOGIES'), entry('DEMOCRACY', 'DEMOCRACIES'), entry('ENTREPRENEUR', 'ENTREPRENEURS'),
    entry('FASCINATING'), entry('GRAVITATION', 'GRAVITATIONS'), entry('HYPOTHESIS', 'HYPOTHESES'), entry('IMAGINATION', 'IMAGINATIONS'), entry('JOURNALISM'),
    entry('KALEIDOSCOPE', 'KALEIDOSCOPES'), entry('LITERATURE', 'LITERATURES'), entry('METAMORPHOSIS', 'METAMORPHOSES'), entry('NEUROSCIENCE', 'NEUROSCIENCES'), entry('OPPORTUNITY', 'OPPORTUNITIES'),
    entry('PHILOSOPHY', 'PHILOSOPHIES'), entry('QUANTITATIVE'), entry('RENAISSANCE', 'RENAISSANCES'), entry('SUSTAINABLE'), entry('THERMODYNAMICS'),
    entry('UNDERSTANDING', 'UNDERSTANDINGS'), entry('VULNERABILITY', 'VULNERABILITIES'), entry('WAVELENGTH', 'WAVELENGTHS'), entry('EXPLORATION', 'EXPLORATIONS'), entry('PERSEVERANCE', 'PERSEVERANCES'),
    entry('ARCHAEOLOGY', 'ARCHAEOLOGIES'), entry('CIRCUMFERENCE', 'CIRCUMFERENCES'), entry('EQUILIBRIUM', 'EQUILIBRIUMS', 'EQUILIBRIA'), entry('INNOVATION', 'INNOVATIONS'), entry('PERSPECTIVE', 'PERSPECTIVES'),
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

function cleanText(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, '');
}

function cleanWords(words: unknown, maxLength: number): WordEntry[] {
  if (!Array.isArray(words)) return [];
  const cleaned = new Map<string, WordEntry>();

  words.forEach((value) => {
    const rawWord = typeof value === 'string'
      ? value
      : value && typeof value === 'object' && 'word' in value
        ? (value as { word?: unknown }).word
        : null;
    if (typeof rawWord !== 'string') return;

    const word = cleanText(rawWord);
    if (word.length < 3 || word.length > maxLength) return;

    const rawAccepted = typeof value === 'object' && value && 'acceptedTranscriptions' in value
      ? (value as { acceptedTranscriptions?: unknown }).acceptedTranscriptions
      : [];
    const acceptedTranscriptions = [
      word,
      ...(Array.isArray(rawAccepted) ? rawAccepted : [])
        .filter((transcription): transcription is string => typeof transcription === 'string')
        .map(cleanText)
        .filter(Boolean),
    ];
    const existing = cleaned.get(word)?.acceptedTranscriptions ?? [];
    cleaned.set(word, {
      word,
      acceptedTranscriptions: [...new Set([...existing, ...acceptedTranscriptions])],
    });
  });

  return [...cleaned.values()];
}

/**
 * Server-ready word source. The game first asks /api/words and gracefully uses
 * the bundled age-level vocabulary when that endpoint is not available yet.
 */
export async function getWords(settings: GameSettings): Promise<{ words: WordEntry[]; source: 'server' | 'offline' }> {
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
