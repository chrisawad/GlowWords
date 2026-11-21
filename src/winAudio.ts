import voiceURL from './assets/you-win.wav?url';

// Arrow Cube's brass harmonics, note envelopes and final C-major chord.
function trumpet(context: AudioContext, wave: PeriodicWave, frequency: number, start: number, duration: number, volume: number) {
  const horn = context.createOscillator(), vibrato = context.createOscillator();
  const filter = context.createBiquadFilter(), gain = context.createGain(), depth = context.createGain();
  horn.setPeriodicWave(wave);
  horn.frequency.setValueAtTime(frequency * .994, start);
  horn.frequency.linearRampToValueAtTime(frequency, start + .025);
  filter.type = 'lowpass'; filter.Q.value = .7;
  filter.frequency.setValueAtTime(frequency * 2, start);
  filter.frequency.exponentialRampToValueAtTime(frequency * 9, start + .025);
  filter.frequency.exponentialRampToValueAtTime(frequency * 4, start + duration);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + .012);
  gain.gain.linearRampToValueAtTime(volume * .7, start + .065);
  gain.gain.setValueAtTime(volume * .65, start + duration - .045);
  gain.gain.linearRampToValueAtTime(0, start + duration);
  vibrato.frequency.value = 5.4;
  depth.gain.setValueAtTime(0, start);
  depth.gain.linearRampToValueAtTime(frequency * .004, start + Math.min(.25, duration * .8));
  vibrato.connect(depth).connect(horn.frequency);
  horn.connect(filter).connect(gain).connect(context.destination);
  horn.onended = () => { for (const node of [horn, vibrato, depth, filter, gain]) node.disconnect(); };
  horn.start(start); vibrato.start(start);
  horn.stop(start + duration + .01); vibrato.stop(start + duration + .01);
  return () => { gain.disconnect(); horn.stop(); vibrato.stop(); };
}

export function createWinAudio() {
  const stops: (() => void)[] = [];
  let sequence = 0;
  let voice: Promise<AudioBuffer | null> | undefined;
  function stop() {
    sequence++;
    for (const silence of stops.splice(0)) silence();
  }
  function loadVoice(context: AudioContext) {
    return voice ??= fetch(voiceURL, { signal: AbortSignal.timeout(5000) })
      .then(response => { if (!response.ok) throw Error('Voice unavailable'); return response.arrayBuffer(); })
      .then(bytes => context.decodeAudioData(bytes))
      .catch(() => { voice = undefined; return null; });
  }
  async function play(context: AudioContext, sayLastWord: () => void) {
    stop();
    const current = sequence;
    let buffer: AudioBuffer | null;
    try {
      [buffer] = await Promise.all([loadVoice(context), context.resume()]);
    } catch {
      if (sequence === current) sayLastWord();
      return;
    }
    if (sequence !== current) return;
    let start = context.currentTime;
    if (buffer) {
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer; gain.gain.value = .8;
      source.connect(gain).connect(context.destination);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        if (sequence === current) sayLastWord();
      };
      source.start(start); stops.push(() => { gain.disconnect(); source.stop(); });
      start += buffer.duration + .12;
    } else sayLastWord();
    const harmonics = new Float32Array([0, 1, .8, .55, .4, .25, .18, .12, .09, .07, .05, .04]);
    const wave = context.createPeriodicWave(new Float32Array(harmonics.length), harmonics);
    for (const [hz, at, duration, level] of [[392, 0, .14, .07], [392, .18, .14, .07], [392, .36, .14, .07],
      [523.25, .57, .2, .07], [659.25, .82, .2, .07], [783.99, 1.07, .85, .07],
      [523.25, 1.07, .85, .018], [659.25, 1.07, .85, .018]]) {
      stops.push(trumpet(context, wave, hz, start + at, duration, level));
    }
  }
  return { play, stop };
}
