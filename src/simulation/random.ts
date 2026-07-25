export interface RandomSource {
  next: () => number;
  range: (min: number, max: number) => number;
  int: (min: number, max: number) => number;
  chance: (probability: number) => boolean;
  pick: <T>(items: readonly T[]) => T;
}

const hashSeed = (seed: string) => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const createRandomSource = (next: () => number): RandomSource => ({
  next,
  range: (min, max) => min + (max - min) * next(),
  int: (min, max) => Math.floor(min + (max - min + 1) * next()),
  chance: (probability) => next() < probability,
  pick: (items) => {
    if (items.length === 0) {
      throw new Error('Cannot pick from an empty collection.');
    }
    return items[Math.floor(next() * items.length)];
  },
});

export const createMathRandomSource = () => createRandomSource(Math.random);

export const createSeededRandom = (seed: string | number): RandomSource => {
  let state = hashSeed(String(seed)) || 1;

  return createRandomSource(() => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  });
};
