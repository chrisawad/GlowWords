export interface PhonicsCue {
  letters: string;
  start: number;
  end: number;
  label: string;
  spoken: string;
}

const LETTER_TEAMS: Record<string, Pick<PhonicsCue, 'label' | 'spoken'>> = {
  CH: { label: 'ch', spoken: 'ch' },
  CK: { label: 'k', spoken: 'kuh' },
  NG: { label: 'ng', spoken: 'ing' },
  PH: { label: 'f', spoken: 'fff' },
  QU: { label: 'kw', spoken: 'kwuh' },
  SH: { label: 'sh', spoken: 'shh' },
  TH: { label: 'th', spoken: 'thh' },
  WH: { label: 'w', spoken: 'wuh' },
};

const LETTER_SOUNDS: Record<string, Pick<PhonicsCue, 'label' | 'spoken'>> = {
  A: { label: 'aah', spoken: 'aah' },
  B: { label: 'b', spoken: 'buh' },
  C: { label: 'k', spoken: 'kuh' },
  D: { label: 'd', spoken: 'duh' },
  E: { label: 'eh', spoken: 'eh' },
  F: { label: 'f', spoken: 'fff' },
  G: { label: 'g', spoken: 'guh' },
  H: { label: 'h', spoken: 'huh' },
  I: { label: 'ih', spoken: 'ih' },
  J: { label: 'j', spoken: 'juh' },
  K: { label: 'k', spoken: 'kuh' },
  L: { label: 'l', spoken: 'lll' },
  M: { label: 'm', spoken: 'mmm' },
  N: { label: 'n', spoken: 'nnn' },
  O: { label: 'o', spoken: 'ah' },
  P: { label: 'p', spoken: 'puh' },
  Q: { label: 'kw', spoken: 'kwuh' },
  R: { label: 'r', spoken: 'rrr' },
  S: { label: 's', spoken: 'sss' },
  T: { label: 't', spoken: 'tuh' },
  U: { label: 'uh', spoken: 'uh' },
  V: { label: 'v', spoken: 'vvv' },
  W: { label: 'w', spoken: 'wuh' },
  X: { label: 'ks', spoken: 'ks' },
  Y: { label: 'y', spoken: 'yuh' },
  Z: { label: 'z', spoken: 'zzz' },
};

const MAGIC_E_SOUNDS: Partial<Record<string, Pick<PhonicsCue, 'label' | 'spoken'>>> = {
  A: { label: 'ay', spoken: 'ay' },
  I: { label: 'eye', spoken: 'eye' },
  O: { label: 'oh', spoken: 'oh' },
  U: { label: 'you', spoken: 'you' },
};

/**
 * Builds a child-friendly sound trail. English phonics has exceptions, so the
 * helper deliberately focuses on dependable consonant teams and common
 * consonant-vowel-consonant-e words instead of pretending to be a dictionary.
 */
export function getPhonicsCues(value: string): PhonicsCue[] {
  const word = value.toUpperCase().replace(/[^A-Z]/g, '');
  const cues: PhonicsCue[] = [];

  for (let index = 0; index < word.length;) {
    const pair = word.slice(index, index + 2);
    const team = LETTER_TEAMS[pair];
    if (team) {
      cues.push({ letters: pair, start: index, end: index + 1, ...team });
      index += 2;
      continue;
    }

    const letter = word[index];
    const next = word[index + 1];
    const isMagicEVowel = index + 2 === word.length - 1
      && word[index + 2] === 'E'
      && next !== undefined
      && !'AEIOU'.includes(next)
      && MAGIC_E_SOUNDS[letter];

    let sound = isMagicEVowel ? MAGIC_E_SOUNDS[letter] : LETTER_SOUNDS[letter];
    if (letter === 'C' && next && 'EIY'.includes(next)) sound = { label: 's', spoken: 'sss' };
    if (letter === 'G' && next && 'EIY'.includes(next)) sound = { label: 'j', spoken: 'juh' };
    if (letter === 'X' && index === 0) sound = { label: 'z', spoken: 'zzz' };
    if (letter === 'Y' && index === word.length - 1 && word.length > 2) sound = { label: 'ee', spoken: 'ee' };
    if (letter === 'E' && index === word.length - 1 && word.length > 2) sound = { label: 'quiet e', spoken: 'quiet e' };

    cues.push({
      letters: letter,
      start: index,
      end: index,
      ...(sound ?? { label: letter.toLowerCase(), spoken: letter.toLowerCase() }),
    });
    index += 1;
  }

  return cues;
}
