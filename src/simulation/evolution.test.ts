import { describe, expect, it } from 'vitest';
import { GENOME_BOUNDS, POPULATION_SIZE } from './constants';
import { runFoodBenchmark } from './benchmark';
import {
  GENE_KEYS,
  createNextPopulation,
  createRandomGenome,
  crossoverGenomes,
  selectParents,
  type ScoredGenome,
} from './genome';
import { createSeededRandom } from './random';

describe('evolution helpers', () => {
  it('crosses over bounded parent genes', () => {
    const rng = createSeededRandom('crossover');
    const parentA = createRandomGenome(rng);
    const parentB = createRandomGenome(rng);
    const child = crossoverGenomes(parentA, parentB, rng, 2);

    expect(child.parentIds).toEqual([parentA.id, parentB.id]);
    for (const gene of GENE_KEYS) {
      expect(child[gene]).toBeGreaterThanOrEqual(GENOME_BOUNDS[gene].min);
      expect(child[gene]).toBeLessThanOrEqual(GENOME_BOUNDS[gene].max);
    }
  });

  it('mutation never exceeds gene bounds across repeated breeding', () => {
    const rng = createSeededRandom('mutation-bounds');
    const parentA = createRandomGenome(rng);
    const parentB = createRandomGenome(rng);

    for (let index = 0; index < 300; index += 1) {
      const child = crossoverGenomes(parentA, parentB, rng, 3);
      for (const gene of GENE_KEYS) {
        expect(child[gene]).toBeGreaterThanOrEqual(GENOME_BOUNDS[gene].min);
        expect(child[gene]).toBeLessThanOrEqual(GENOME_BOUNDS[gene].max);
      }
    }
  });

  it('selects the strongest fitness group as parents', () => {
    const rng = createSeededRandom('selection');
    const scored: ScoredGenome[] = Array.from({ length: POPULATION_SIZE }, (_, index) => ({
      genome: createRandomGenome(rng),
      fitness: index,
      foodEaten: index % 4,
      alive: index > 10,
    }));

    const parents = selectParents(scored);

    expect(parents).toHaveLength(2);
    expect(parents.map((parent) => parent.id)).toEqual(
      scored
        .slice(-2)
        .reverse()
        .map((entry) => entry.genome.id),
    );
  });

  it('handles empty parent pools by creating a fresh bounded population', () => {
    const next = createNextPopulation([], createSeededRandom('empty-pool'), 2);

    expect(next.parents).toEqual([]);
    expect(next.genomes).toHaveLength(POPULATION_SIZE);
    for (const genome of next.genomes) {
      for (const gene of GENE_KEYS) {
        expect(genome[gene]).toBeGreaterThanOrEqual(GENOME_BOUNDS[gene].min);
        expect(genome[gene]).toBeLessThanOrEqual(GENOME_BOUNDS[gene].max);
      }
    }
  });

  it('does not regress below generation-one median fitness after five benchmark generations', () => {
    const history = runFoodBenchmark('m1-fixed-food-arena', 5);
    const first = history[0];
    const fifth = history[4];

    expect(fifth.medianFitness).toBeGreaterThanOrEqual(first.medianFitness);
    expect(fifth.averageFitness).toBeGreaterThan(first.averageFitness);
  });
});
