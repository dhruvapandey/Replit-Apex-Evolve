import { POPULATION_SIZE } from './constants';
import { calculateCreatureFitness } from './fitness';
import { createNextPopulation, createRandomGenome, type ScoredGenome } from './genome';
import { createSeededRandom } from './random';

export interface BenchmarkGeneration {
  generation: number;
  medianFitness: number;
  averageFitness: number;
  bestFitness: number;
  bestFoodCount: number;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[midpoint - 1] + sorted[midpoint]) / 2 : sorted[midpoint];
};

export const runFoodBenchmark = (seed = 'evolab-food-benchmark', generations = 5): BenchmarkGeneration[] => {
  const rng = createSeededRandom(seed);
  let genomes = Array.from({ length: POPULATION_SIZE }, () => createRandomGenome(rng));
  const history: BenchmarkGeneration[] = [];

  for (let generation = 1; generation <= generations; generation += 1) {
    const scored: ScoredGenome[] = genomes.map((genome) => {
      const normalizedVision = (genome.vision - 95) / 205;
      const foodSeeking =
        genome.foodAttraction * 2.7 +
        genome.speed * 1.2 +
        normalizedVision * 0.9 +
        genome.energyEfficiency * 0.35 -
        genome.wander * 0.7 +
        rng.range(-0.12, 0.12);
      const foodEaten = Math.max(0, Math.min(5, Math.floor(foodSeeking * 1.35)));
      const alive = foodSeeking > 1.15;
      const fitness = calculateCreatureFitness({
        foodEaten,
        ageSeconds: alive ? 20 : rng.range(9, 18),
        health: alive ? 88 : 28,
        energy: alive ? 68 : 8,
        poisonHits: 0,
        predatorHits: 0,
        alive,
      });

      return { genome, fitness, foodEaten, alive };
    });

    const fitnesses = scored.map((entry) => entry.fitness);
    history.push({
      generation,
      medianFitness: median(fitnesses),
      averageFitness: fitnesses.reduce((sum, value) => sum + value, 0) / fitnesses.length,
      bestFitness: Math.max(...fitnesses),
      bestFoodCount: Math.max(...scored.map((entry) => entry.foodEaten)),
    });

    genomes = createNextPopulation(scored, rng, generation + 1).genomes;
  }

  return history;
};
