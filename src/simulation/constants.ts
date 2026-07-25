export const POPULATION_SIZE = 10;
export const GENERATION_DURATION_MS = 20_000;
export const OBJECTIVE_TARGET = 5;
export const MUTATION_RATE = 0.2;
export const MUTATION_STRENGTH = 0.18;
export const SELECTION_RATIO = 0.2;

export const CREATURE_MAX_HEALTH = 100;
export const CREATURE_MAX_ENERGY = 100;
export const FOOD_ENERGY_GAIN = 42;
export const POISON_DAMAGE = 62;
export const PREDATOR_DAMAGE = 100;

export const GENOME_BOUNDS = {
  foodAttraction: { min: 0.05, max: 1 },
  poisonAvoidance: { min: 0.05, max: 1 },
  predatorAvoidance: { min: 0.05, max: 1 },
  wander: { min: 0.05, max: 1 },
  speed: { min: 0.1, max: 1 },
  vision: { min: 95, max: 300 },
  size: { min: 0.15, max: 0.9 },
  energyEfficiency: { min: 0.1, max: 1 },
} as const;

export type GeneKey = keyof typeof GENOME_BOUNDS;
