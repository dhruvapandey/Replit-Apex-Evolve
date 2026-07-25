import type { GenerationSummary } from '../game/types';
import { CREATURE_MAX_ENERGY, CREATURE_MAX_HEALTH, POPULATION_SIZE } from './constants';
import type { ScoredGenome } from './genome';

export interface FitnessInput {
  foodEaten: number;
  ageSeconds: number;
  health: number;
  energy: number;
  poisonHits: number;
  predatorHits: number;
  alive: boolean;
}

export const calculateCreatureFitness = (input: FitnessInput) => {
  const safeFood = Math.max(0, input.foodEaten);
  const safeAge = Math.max(0, input.ageSeconds);
  const healthRatio = Math.max(0, input.health) / CREATURE_MAX_HEALTH;
  const energyRatio = Math.max(0, input.energy) / CREATURE_MAX_ENERGY;
  const survivalBonus = input.alive ? 7 : 0;

  const score =
    safeFood * 24 +
    safeAge * 0.55 +
    healthRatio * 6 +
    energyRatio * 5 +
    survivalBonus -
    input.poisonHits * 14 -
    input.predatorHits * 18;

  return Number.isFinite(score) ? Math.max(-50, score) : -50;
};

export const summarizeScoredGenomes = (
  generation: number,
  scored: readonly ScoredGenome[],
  parentIds: string[],
  previousSummary: GenerationSummary | null,
): GenerationSummary => {
  const ranked = [...scored].sort((a, b) => b.fitness - a.fitness);
  const best = ranked[0] ?? null;
  const totalFitness = scored.reduce((sum, entry) => sum + entry.fitness, 0);
  const averageFitness = scored.length > 0 ? totalFitness / scored.length : 0;

  return {
    generation,
    population: scored.length || POPULATION_SIZE,
    survivors: scored.filter((entry) => entry.alive).length,
    totalFoodEaten: scored.reduce((sum, entry) => sum + entry.foodEaten, 0),
    bestFitness: best?.fitness ?? 0,
    averageFitness,
    bestFoodCount: best?.foodEaten ?? 0,
    bestCreatureId: best?.genome.id ?? null,
    parentIds,
    improvementFromPrevious: previousSummary ? (best?.fitness ?? 0) - previousSummary.bestFitness : null,
  };
};
