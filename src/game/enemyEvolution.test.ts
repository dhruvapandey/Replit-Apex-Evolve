import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../simulation/random';
import { ENEMY_ROLES } from './enemyAi';
import {
  GENE_BOUNDS,
  GENE_KEYS,
  MAX_COMBAT_GENE_BUDGET,
  createFounderEnemyGenomes,
  enemyGenomeBudget,
  enemyGenomeStrength,
  evolveEnemyGenomes,
} from './enemyEvolution';

describe('enemy combat evolution', () => {
  it('creates exactly one founder for each specialist role', () => {
    const founders = createFounderEnemyGenomes(createSeededRandom('founders'));
    expect(founders).toHaveLength(6);
    expect(founders.map((genome) => genome.role)).toEqual(ENEMY_ROLES);
  });

  it('cross-breeds the strongest combatants into all six lineages', () => {
    const founders = createFounderEnemyGenomes(createSeededRandom('selection'));
    const scored = founders.map((genome, index) => ({ genome, fitness: index * 10 }));
    const strongestIds = new Set(scored.slice(-3).map((entry) => entry.genome.id));
    const result = evolveEnemyGenomes(scored, createSeededRandom('offspring'), 2);

    expect(result.genomes).toHaveLength(6);
    expect(result.genomes.map((genome) => genome.role)).toEqual(ENEMY_ROLES);
    expect(result.genomes.every((genome) => genome.parentIds.some((id) => strongestIds.has(id)))).toBe(true);
  });

  it('raises every specialist combat budget while preserving trade-offs', () => {
    const founders = createFounderEnemyGenomes(createSeededRandom('improvement'));
    const result = evolveEnemyGenomes(
      founders.map((genome, index) => ({ genome, fitness: 50 - index })),
      createSeededRandom('improvement-next'),
      2,
    );

    result.genomes.forEach((genome) => {
      const parent = founders.find((candidate) => candidate.role === genome.role)!;
      expect(enemyGenomeBudget(genome)).toBeGreaterThan(enemyGenomeBudget(parent));
      expect(enemyGenomeBudget(genome)).toBeLessThanOrEqual(MAX_COMBAT_GENE_BUDGET);
    });
    expect(result.mutationPercent).toBeGreaterThan(0);
  });

  it('keeps genes inside safe combat bounds through repeated breeding', () => {
    const rng = createSeededRandom('bounded-combat-evolution');
    let genomes = createFounderEnemyGenomes(rng);

    for (let generation = 2; generation <= 80; generation += 1) {
      const result = evolveEnemyGenomes(
        genomes.map((genome, index) => ({ genome, fitness: generation * (index + 1) })),
        rng,
        generation,
      );
      genomes = result.genomes;
    }

    genomes.forEach(({ genes }) => {
      expect(genes.speed).toBeGreaterThanOrEqual(2.4);
      expect(genes.speed).toBeLessThanOrEqual(6.8);
      expect(genes.accuracy).toBeGreaterThanOrEqual(0.28);
      expect(genes.accuracy).toBeLessThanOrEqual(0.96);
      expect(genes.fireInterval).toBeGreaterThanOrEqual(0.72);
      expect(genes.fireInterval).toBeLessThanOrEqual(2.6);
      expect(genes.aggression).toBeGreaterThanOrEqual(0.38);
      expect(genes.aggression).toBeLessThanOrEqual(1);
      expect(genes.predictionLead).toBeGreaterThanOrEqual(0.25);
      expect(genes.predictionLead).toBeLessThanOrEqual(1.6);
      expect(genes.projectileSpeed).toBeGreaterThanOrEqual(16);
      expect(genes.projectileSpeed).toBeLessThanOrEqual(32);
      expect(genes.coverDiscipline).toBeGreaterThanOrEqual(0.2);
      expect(genes.coverDiscipline).toBeLessThanOrEqual(1);
      expect(genes.evasion).toBeGreaterThanOrEqual(0.18);
      expect(genes.evasion).toBeLessThanOrEqual(1);
      expect(genes.navigation).toBeGreaterThanOrEqual(0.3);
      expect(genes.navigation).toBeLessThanOrEqual(1);
    });
  });

  it('raises mutation pressure when adaptive evolution is enabled', () => {
    const founders = createFounderEnemyGenomes(createSeededRandom('adaptive-founders'));
    const result = evolveEnemyGenomes(
      founders.map((genome, index) => ({ genome, fitness: index })),
      createSeededRandom('adaptive-next'),
      2,
      { adaptiveMutation: true },
    );

    expect(result.adaptiveMutation).toBe(true);
    expect(result.configuredMutationRate).toBeGreaterThan(0.22);
  });

  it('progresses quickly without maxing every gene by generation thirty', () => {
    const rng = createSeededRandom('fast-with-tradeoffs');
    let genomes = createFounderEnemyGenomes(rng);
    const founderStrength = genomes.reduce((sum, genome) => sum + enemyGenomeStrength(genome), 0) / genomes.length;

    for (let generation = 2; generation <= 30; generation += 1) {
      genomes = evolveEnemyGenomes(
        genomes.map((genome, index) => ({ genome, fitness: rng.range(0, 100) + index })),
        rng,
        generation,
        { adaptiveMutation: generation % 7 === 0 },
      ).genomes;
    }

    const evolvedStrength = genomes.reduce((sum, genome) => sum + enemyGenomeStrength(genome), 0) / genomes.length;
    expect(evolvedStrength).toBeGreaterThan(founderStrength * 1.25);
    genomes.forEach((genome) => {
      expect(enemyGenomeBudget(genome)).toBeLessThanOrEqual(MAX_COMBAT_GENE_BUDGET);
      expect(GENE_KEYS.some((gene) => {
        const bounds = GENE_BOUNDS[gene];
        return bounds.lowerIsBetter
          ? genome.genes[gene] > bounds.min + 0.0001
          : genome.genes[gene] < bounds.max - 0.0001;
      })).toBe(true);
    });
  });
});
