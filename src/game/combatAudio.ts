import {
  isPlatformAudioMuted,
  subscribeToPlatformMute,
} from '../platformAudio';

export type CombatSound =
  | 'player-cannon'
  | 'enemy-cannon'
  | 'mortar-launch'
  | 'incoming-mortar'
  | 'explosion'
  | 'concrete-impact'
  | 'tank-hit'
  | 'tank-destroyed'
  | 'electric-spark'
  | 'pole-fall'
  | 'smoke-grenade'
  | 'flashbang';

export const COMBAT_SAMPLE_URLS = {
  cannon: 'https://cdn.freesound.org/previews/467/467883_5487341-hq.mp3',
  gunfire: 'https://cdn.freesound.org/previews/414/414023_6417448-hq.mp3',
  artillery: 'https://cdn.freesound.org/previews/239/239137_71257-hq.mp3',
  explosion: 'https://cdn.freesound.org/previews/232/232398_3270296-hq.mp3',
} as const;

type CombatSample = keyof typeof COMBAT_SAMPLE_URLS;
type SampleOptions = {
  duration?: number;
  echo?: number;
  lowpass?: number;
  offset?: number;
  playbackRate?: number;
};

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.max(minimum, Math.min(maximum, value))
);

export function soundVolumeForDistance(distance: number, audibleDistance = 72) {
  if (audibleDistance <= 0) return 0;
  const normalized = clamp(distance / audibleDistance, 0, 1);
  return (1 - normalized) ** 1.35;
}

export function createCombatAudio() {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let userMuted = false;
  let platformMuted = isPlatformAudioMuted();
  const sampleBuffers = new Map<CombatSample, AudioBuffer>();
  const sampleRequests = new Map<CombatSample, Promise<void>>();
  const effectiveMuted = () => userMuted || platformMuted;
  const applyMasterVolume = () => {
    if (context && master) {
      master.gain.setTargetAtTime(effectiveMuted() ? 0 : 0.82, context.currentTime, 0.025);
    }
  };
  const unsubscribePlatformMute = subscribeToPlatformMute((muted) => {
    platformMuted = muted;
    applyMasterVolume();
  });

  const ensureContext = () => {
    if (context && master) return { context, master };
    try {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = effectiveMuted() ? 0 : 0.82;
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 12;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.24;
      master.connect(compressor).connect(context.destination);
      return { context, master };
    } catch {
      return null;
    }
  };

  const loadSample = (sample: CombatSample) => {
    if (sampleBuffers.has(sample)) return Promise.resolve();
    const existing = sampleRequests.get(sample);
    if (existing) return existing;
    const audio = ensureContext();
    if (!audio) return Promise.resolve();
    const requestContext = audio.context;
    const request = fetch(COMBAT_SAMPLE_URLS[sample], { mode: 'cors' })
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load combat sample: ${sample}`);
        return response.arrayBuffer();
      })
      .then((data) => requestContext.decodeAudioData(data))
      .then((buffer) => {
        if (context === requestContext) sampleBuffers.set(sample, buffer);
      })
      .catch(() => {
        // The layered procedural fallback still works when the game is offline.
      })
      .finally(() => sampleRequests.delete(sample));
    sampleRequests.set(sample, request);
    return request;
  };

  const preloadSamples = () => {
    (Object.keys(COMBAT_SAMPLE_URLS) as CombatSample[]).forEach((sample) => {
      void loadSample(sample);
    });
  };

  const unlock = () => {
    const audio = ensureContext();
    if (audio?.context.state === 'suspended') void audio.context.resume();
    preloadSamples();
  };

  const tone = (
    startFrequency: number,
    endFrequency: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'sine',
    delay = 0,
  ) => {
    const audio = ensureContext();
    if (!audio || volume <= 0) return;
    const start = audio.context.currentTime + delay;
    const oscillator = audio.context.createOscillator();
    const gain = audio.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(1, startFrequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(audio.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  };

  const noise = (
    duration: number,
    volume: number,
    filterFrequency: number,
    filterType: BiquadFilterType = 'lowpass',
    delay = 0,
    resonance = 0.7,
  ) => {
    const audio = ensureContext();
    if (!audio || volume <= 0) return;
    const length = Math.max(1, Math.floor(audio.context.sampleRate * duration));
    const buffer = audio.context.createBuffer(1, length, audio.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      const decay = 1 - index / length;
      data[index] = (Math.random() * 2 - 1) * decay * decay;
    }
    const source = audio.context.createBufferSource();
    const filter = audio.context.createBiquadFilter();
    const gain = audio.context.createGain();
    const start = audio.context.currentTime + delay;
    source.buffer = buffer;
    filter.type = filterType;
    filter.frequency.value = filterFrequency;
    filter.Q.value = resonance;
    gain.gain.setValueAtTime(Math.max(0.001, volume), start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter).connect(gain).connect(audio.master);
    source.start(start);
    source.stop(start + duration + 0.02);
  };

  const playSample = (
    sample: CombatSample,
    volume: number,
    options: SampleOptions = {},
  ) => {
    const audio = ensureContext();
    const buffer = sampleBuffers.get(sample);
    if (!audio || !buffer || volume <= 0) {
      void loadSample(sample);
      return false;
    }
    const source = audio.context.createBufferSource();
    const gain = audio.context.createGain();
    const filter = audio.context.createBiquadFilter();
    const start = audio.context.currentTime;
    const offset = Math.min(options.offset ?? 0, Math.max(0, buffer.duration - 0.02));
    const duration = Math.min(options.duration ?? buffer.duration, buffer.duration - offset);
    source.buffer = buffer;
    source.playbackRate.value = options.playbackRate ?? 1;
    filter.type = 'lowpass';
    filter.frequency.value = options.lowpass ?? 12_000;
    filter.Q.value = 0.45;
    gain.gain.setValueAtTime(Math.max(0.001, volume), start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + Math.max(0.08, duration));
    source.connect(filter).connect(gain).connect(audio.master);

    if (options.echo) {
      const delay = audio.context.createDelay(0.5);
      const echoGain = audio.context.createGain();
      const echoFilter = audio.context.createBiquadFilter();
      delay.delayTime.value = options.echo;
      echoGain.gain.value = volume * 0.16;
      echoFilter.type = 'lowpass';
      echoFilter.frequency.value = 2400;
      source.connect(delay).connect(echoFilter).connect(echoGain).connect(audio.master);
    }

    source.start(start, offset, duration);
    return true;
  };

  const weaponMechanism = (level: number, delay = 0.055) => {
    noise(0.045, 0.12 * level, 2400, 'bandpass', delay, 3.2);
    tone(240, 110, 0.075, 0.055 * level, 'triangle', delay + 0.012);
  };

  const play = (sound: CombatSound, volume = 1, duration = 1.2) => {
    const level = clamp(volume, 0, 1);
    if (effectiveMuted() || level <= 0) return;
    unlock();

    switch (sound) {
      case 'player-cannon':
        playSample('cannon', 0.95 * level, { duration: 1.55, echo: 0.14, lowpass: 9000, playbackRate: 0.92 });
        noise(0.038, 0.5 * level, 6200, 'highpass', 0, 0.35);
        noise(0.22, 0.26 * level, 680, 'lowpass');
        tone(62, 31, 0.28, 0.2 * level, 'sine');
        weaponMechanism(level);
        break;
      case 'enemy-cannon':
        playSample('gunfire', 0.58 * level, { duration: 1.55, echo: 0.11, lowpass: 7600, playbackRate: 0.96 });
        noise(0.03, 0.34 * level, 7200, 'highpass');
        noise(0.16, 0.16 * level, 820, 'lowpass');
        weaponMechanism(level, 0.045);
        break;
      case 'mortar-launch':
        playSample('artillery', 0.72 * level, { duration: 1.65, echo: 0.18, lowpass: 6500, playbackRate: 0.82 });
        noise(0.3, 0.34 * level, 620, 'lowpass');
        tone(74, 34, 0.35, 0.22 * level, 'sine');
        weaponMechanism(level, 0.085);
        break;
      case 'incoming-mortar':
        noise(Math.max(0.35, duration), 0.025 * level, 1250, 'bandpass', 0, 2.8);
        tone(880, 165, Math.max(0.35, duration), 0.095 * level, 'sine');
        break;
      case 'explosion':
        playSample('explosion', 0.9 * level, { duration: 3.4, echo: 0.2, lowpass: 7200, playbackRate: 0.96 });
        noise(0.6, 0.32 * level, 740, 'lowpass');
        tone(58, 24, 0.72, 0.3 * level, 'sine');
        break;
      case 'concrete-impact':
        noise(0.12, 0.3 * level, 2100, 'highpass');
        noise(0.28, 0.18 * level, 680, 'lowpass');
        weaponMechanism(level, 0.025);
        break;
      case 'tank-hit':
        noise(0.16, 0.36 * level, 1850, 'bandpass', 0, 1.8);
        noise(0.3, 0.2 * level, 520, 'lowpass');
        tone(190, 54, 0.3, 0.16 * level, 'triangle');
        break;
      case 'tank-destroyed':
        playSample('explosion', 1 * level, { duration: 4.2, echo: 0.23, lowpass: 6200, playbackRate: 0.78 });
        noise(0.85, 0.42 * level, 620, 'lowpass');
        tone(52, 19, 0.9, 0.36 * level, 'sine');
        noise(0.2, 0.17 * level, 2700, 'highpass', 0.16);
        break;
      case 'electric-spark':
        noise(0.095, 0.18 * level, 3200, 'highpass');
        tone(1900, 510, 0.075, 0.055 * level, 'triangle');
        break;
      case 'pole-fall':
        noise(0.36, 0.36 * level, 490, 'lowpass');
        noise(0.12, 0.16 * level, 2300, 'bandpass', 0.08, 2.4);
        tone(55, 24, 0.35, 0.25 * level, 'sine');
        break;
      case 'smoke-grenade':
        noise(0.09, 0.22 * level, 1900, 'bandpass', 0, 1.8);
        noise(0.58, 0.075 * level, 3600, 'highpass', 0.04, 0.5);
        tone(170, 78, 0.16, 0.08 * level, 'triangle');
        break;
      case 'flashbang':
        noise(0.055, 0.46 * level, 6500, 'highpass', 0, 0.35);
        tone(2600, 520, 0.34, 0.14 * level, 'sine');
        noise(0.22, 0.12 * level, 1250, 'bandpass', 0.04, 3.2);
        break;
    }
  };

  const toggleMuted = () => {
    userMuted = !userMuted;
    applyMasterVolume();
    return effectiveMuted();
  };

  const close = () => {
    unsubscribePlatformMute();
    if (context) void context.close();
    context = null;
    master = null;
    sampleBuffers.clear();
    sampleRequests.clear();
  };

  return { close, play, toggleMuted, unlock };
}
