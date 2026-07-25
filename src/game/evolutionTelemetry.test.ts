import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../simulation/random';
import { createFounderEnemyGenomes, evolveEnemyGenomes } from './enemyEvolution';
import {
  appendGenerationRecord,
  createGenerationRecord,
  emptyEvolutionArchive,
  parseEvolutionArchive,
  shouldUseAdaptiveMutation,
  startEvolutionRun,
  type EnemyCombatResult,
} from './evolutionTelemetry';

const combatResults = (seed: string): EnemyCombatResult[] => (
  createFounderEnemyGenomes(createSeededRandom(seed)).map((genome, index) => ({
    genome,
    fitness: index * 12,
    stats: {
      survivalSeconds: 15 + index,
      shotsFired: 4 + index,
      cannonHits: index % 2,
      mortarHits: genome.role === 'artillery' ? 1 : 0,
      damageTaken: 2,
    },
  }))
);

describe('development evolution telemetry', () => {
  it('records genomes, combat performance, parents, and offspring', () => {
    const results = combatResults('recording');
    const evolution = evolveEnemyGenomes(
      results,
      createSeededRandom('recording-next'),
      2,
    );
    const record = createGenerationRecord({
      generation: 1,
      results,
      evolution,
      previousPlateauStreak: 0,
      durationSeconds: 42.456,
      score: 2100,
      livesRemaining: 3,
    });

    expect(record.population).toHaveLength(6);
    expect(record.offspring).toHaveLength(6);
    expect(record.selectedParentIds).toHaveLength(3);
    expect(record.population[4].stats.mortarHits).toBe(1);
    expect(record.durationSeconds).toBe(42.46);
  });

  it('detects repeated low improvement and enables adaptive mutation', () => {
    expect(shouldUseAdaptiveMutation(1)).toBe(false);
    expect(shouldUseAdaptiveMutation(2)).toBe(true);

    const results = combatResults('plateau');
    const stalledEvolution = {
      genomes: results.map(({ genome }) => ({ ...genome, generation: 2 })),
      mutationPercent: 0,
      parentIds: results.slice(0, 3).map(({ genome }) => genome.id),
      adaptiveMutation: true,
      configuredMutationRate: 0.38,
    };
    const record = createGenerationRecord({
      generation: 3,
      results,
      evolution: stalledEvolution,
      previousPlateauStreak: 2,
      durationSeconds: 20,
      score: 1000,
      livesRemaining: 5,
    });

    expect(record.improvementPercent).toBe(0);
    expect(record.plateauDetected).toBe(true);
    expect(record.plateauStreak).toBe(3);
  });

  it('archives records without losing earlier development runs', () => {
    const results = combatResults('archive');
    const evolution = evolveEnemyGenomes(results, createSeededRandom('archive-next'), 2);
    const record = createGenerationRecord({
      generation: 1,
      results,
      evolution,
      previousPlateauStreak: 0,
      durationSeconds: 20,
      score: 1000,
      livesRemaining: 4,
    });
    const firstRun = startEvolutionRun(emptyEvolutionArchive(), 'run-one', '2026-01-01T00:00:00.000Z');
    const recorded = appendGenerationRecord(firstRun, 'run-one', record);
    const withSecondRun = startEvolutionRun(recorded, 'run-two', '2026-01-02T00:00:00.000Z');
    const restored = parseEvolutionArchive(JSON.stringify(withSecondRun));

    expect(restored.runs).toHaveLength(2);
    expect(restored.runs[1].records).toHaveLength(1);
  });
});
