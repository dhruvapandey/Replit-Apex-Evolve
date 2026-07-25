import type { Genome } from '../game/types';
import {
  GENOME_BOUNDS,
  MUTATION_RATE,
  MUTATION_STRENGTH,
  POPULATION_SIZE,
  SELECTION_RATIO,
  type GeneKey,
} from './constants';
import type { RandomSource } from './random';

export interface ScoredGenome {
  genome: Genome;
  fitness: number;
  foodEaten: number;
  alive: boolean;
}

export interface NextPopulationResult {
  genomes: Genome[];
  parents: Genome[];
}

export const GENE_KEYS = Object.keys(GENOME_BOUNDS) as GeneKey[];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const clampGene = (gene: GeneKey, value: number) => {
  const bounds = GENOME_BOUNDS[gene];
  return clamp(Number.isFinite(value) ? value : bounds.min, bounds.min, bounds.max);
};

const createGenomeId = (rng: RandomSource) => `EV${rng.int(100000, 999999).toString(36).toUpperCase()}`;

export const clampGenome = (genome: Genome): Genome => ({
  ...genome,
  foodAttraction: clampGene('foodAttraction', genome.foodAttraction),
  poisonAvoidance: clampGene('poisonAvoidance', genome.poisonAvoidance),
  predatorAvoidance: clampGene('predatorAvoidance', genome.predatorAvoidance),
  wander: clampGene('wander', genome.wander),
  speed: clampGene('speed', genome.speed),
  vision: clampGene('vision', genome.vision),
  size: clampGene('size', genome.size),
  energyEfficiency: clampGene('energyEfficiency', genome.energyEfficiency),
});

export const createRandomGenome = (rng: RandomSource, generation = 1, parentIds: string[] = []): Genome => ({
  id: createGenomeId(rng),
  generation,
  parentIds,
  foodAttraction: rng.range(0.12, 0.72),
  poisonAvoidance: rng.range(0.08, 0.72),
  predatorAvoidance: rng.range(0.08, 0.72),
  wander: rng.range(0.28, 1),
  speed: rng.range(0.22, 0.86),
  vision: rng.range(115, 230),
  size: rng.range(0.22, 0.78),
  energyEfficiency: rng.range(0.25, 0.86),
});

export const crossoverGenomes = (
  parentA: Genome,
  parentB: Genome,
  rng: RandomSource,
  generation: number,
): Genome => {
  const child: Genome = {
    id: createGenomeId(rng),
    generation,
    parentIds: Array.from(new Set([parentA.id, parentB.id])),
    foodAttraction: 0,
    poisonAvoidance: 0,
    predatorAvoidance: 0,
    wander: 0,
    speed: 0,
    vision: 0,
    size: 0,
    energyEfficiency: 0,
  };

  for (const gene of GENE_KEYS) {
    const inherited = rng.chance(0.5) ? parentA[gene] : parentB[gene];
    const bounds = GENOME_BOUNDS[gene];
    const mutationSpan = (bounds.max - bounds.min) * MUTATION_STRENGTH;
    const mutation = rng.chance(MUTATION_RATE) ? rng.range(-mutationSpan, mutationSpan) : 0;
    child[gene] = clampGene(gene, inherited + mutation);
  }

  return child;
};

export const describeGenomeTraits = (genome: Genome): string[] => {
  const traits: string[] = [];
  if (genome.foodAttraction > 0.72) traits.push('Food-driven');
  if (genome.poisonAvoidance > 0.7) traits.push('Cautious');
  if (genome.predatorAvoidance > 0.7) traits.push('Evasive');
  if (genome.speed > 0.72) traits.push('Fast');
  if (genome.vision > 240) traits.push('Wide-eyed');
  if (genome.energyEfficiency > 0.72) traits.push('Efficient');
  if (genome.wander > 0.76) traits.push('Curious');
  if (traits.length === 0) traits.push('Balanced');
  return traits.slice(0, 3);
};

export const selectParents = (
  scored: readonly ScoredGenome[],
  populationSize = POPULATION_SIZE,
  selectionRatio = SELECTION_RATIO,
): Genome[] => {
  const valid = scored
    .filter((entry) => Number.isFinite(entry.fitness))
    .sort((a, b) => b.fitness - a.fitness || b.foodEaten - a.foodEaten);

  if (valid.length === 0) return [];

  const parentCount = Math.min(valid.length, Math.max(2, Math.ceil(populationSize * selectionRatio)));
  return valid.slice(0, parentCount).map((entry) => entry.genome);
};

export const createNextPopulation = (
  scored: readonly ScoredGenome[],
  rng: RandomSource,
  generation: number,
  populationSize = POPULATION_SIZE,
): NextPopulationResult => {
  const parents = selectParents(scored, populationSize);

  if (parents.length === 0) {
    return {
      parents: [],
      genomes: Array.from({ length: populationSize }, () => createRandomGenome(rng, generation)),
    };
  }

  const genomes = Array.from({ length: populationSize }, () => {
    const parentA = rng.pick(parents);
    const parentB = parents.length > 1 ? rng.pick(parents) : parentA;
    return crossoverGenomes(parentA, parentB, rng, generation);
  });

  return { genomes, parents };
};
