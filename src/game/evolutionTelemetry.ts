import {
  enemyGenomeStrength,
  type EnemyEvolutionResult,
  type EnemyGenome,
  type ScoredEnemyGenome,
} from './enemyEvolution';

export const PLATEAU_IMPROVEMENT_PERCENT = 1.5;
export const PLATEAU_STREAK_REQUIRED = 3;
export const EVOLUTION_ARCHIVE_VERSION = 1;
export const MAX_ARCHIVED_RUNS = 8;

export type EnemyCombatStats = {
  survivalSeconds: number;
  shotsFired: number;
  cannonHits: number;
  mortarHits: number;
  damageTaken: number;
};

export type EnemyCombatResult = ScoredEnemyGenome & {
  stats: EnemyCombatStats;
};

export type RecordedEnemy = {
  id: string;
  role: EnemyGenome['role'];
  parentIds: string[];
  fitness: number;
  genes: EnemyGenome['genes'];
  stats: EnemyCombatStats;
};

export type RecordedOffspring = {
  id: string;
  role: EnemyGenome['role'];
  parentIds: string[];
  genes: EnemyGenome['genes'];
};

export type GenerationRecord = {
  generation: number;
  completedAt: string;
  durationSeconds: number;
  score: number;
  livesRemaining: number;
  averageFitness: number;
  bestFitness: number;
  averageStrength: number;
  nextAverageStrength: number;
  improvementPercent: number;
  mutationPercent: number;
  configuredMutationRate: number;
  adaptiveMutation: boolean;
  lowImprovement: boolean;
  plateauStreak: number;
  plateauDetected: boolean;
  selectedParentIds: string[];
  population: RecordedEnemy[];
  offspring: RecordedOffspring[];
};

export type EvolutionRunLog = {
  id: string;
  startedAt: string;
  records: GenerationRecord[];
};

export type EvolutionArchive = {
  version: typeof EVOLUTION_ARCHIVE_VERSION;
  runs: EvolutionRunLog[];
};

const mean = (values: readonly number[]) => (
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
);

export function shouldUseAdaptiveMutation(plateauStreak: number) {
  return plateauStreak >= PLATEAU_STREAK_REQUIRED - 1;
}

export function createGenerationRecord({
  generation,
  results,
  evolution,
  previousPlateauStreak,
  durationSeconds,
  score,
  livesRemaining,
}: {
  generation: number;
  results: readonly EnemyCombatResult[];
  evolution: EnemyEvolutionResult;
  previousPlateauStreak: number;
  durationSeconds: number;
  score: number;
  livesRemaining: number;
}): GenerationRecord {
  const averageStrength = mean(results.map(({ genome }) => enemyGenomeStrength(genome)));
  const nextAverageStrength = mean(evolution.genomes.map(enemyGenomeStrength));
  const improvementPercent = averageStrength > 0
    ? ((nextAverageStrength - averageStrength) / averageStrength) * 100
    : 0;
  const lowImprovement = improvementPercent < PLATEAU_IMPROVEMENT_PERCENT;
  const plateauStreak = lowImprovement ? previousPlateauStreak + 1 : 0;
  const fitnessValues = results.map(({ fitness }) => fitness);

  return {
    generation,
    completedAt: new Date().toISOString(),
    durationSeconds: Number(durationSeconds.toFixed(2)),
    score,
    livesRemaining,
    averageFitness: mean(fitnessValues),
    bestFitness: fitnessValues.length > 0 ? Math.max(...fitnessValues) : 0,
    averageStrength,
    nextAverageStrength,
    improvementPercent,
    mutationPercent: evolution.mutationPercent,
    configuredMutationRate: evolution.configuredMutationRate,
    adaptiveMutation: evolution.adaptiveMutation,
    lowImprovement,
    plateauStreak,
    plateauDetected: plateauStreak >= PLATEAU_STREAK_REQUIRED,
    selectedParentIds: [...evolution.parentIds],
    population: results.map(({ genome, fitness, stats }) => ({
      id: genome.id,
      role: genome.role,
      parentIds: [...genome.parentIds],
      fitness,
      genes: { ...genome.genes },
      stats: { ...stats },
    })),
    offspring: evolution.genomes.map((genome) => ({
      id: genome.id,
      role: genome.role,
      parentIds: [...genome.parentIds],
      genes: { ...genome.genes },
    })),
  };
}

export function emptyEvolutionArchive(): EvolutionArchive {
  return { version: EVOLUTION_ARCHIVE_VERSION, runs: [] };
}

export function startEvolutionRun(
  archive: EvolutionArchive,
  id: string,
  startedAt = new Date().toISOString(),
): EvolutionArchive {
  const nextRun: EvolutionRunLog = { id, startedAt, records: [] };
  return {
    version: EVOLUTION_ARCHIVE_VERSION,
    runs: [nextRun, ...archive.runs.filter((run) => run.id !== id)].slice(0, MAX_ARCHIVED_RUNS),
  };
}

export function appendGenerationRecord(
  archive: EvolutionArchive,
  runId: string,
  record: GenerationRecord,
): EvolutionArchive {
  return {
    ...archive,
    runs: archive.runs.map((run) => run.id === runId
      ? {
        ...run,
        records: [
          ...run.records.filter((candidate) => candidate.generation !== record.generation),
          record,
        ].sort((first, second) => first.generation - second.generation),
      }
      : run),
  };
}

export function parseEvolutionArchive(serialized: string | null): EvolutionArchive {
  if (!serialized) return emptyEvolutionArchive();
  try {
    const parsed = JSON.parse(serialized) as Partial<EvolutionArchive>;
    if (parsed.version !== EVOLUTION_ARCHIVE_VERSION || !Array.isArray(parsed.runs)) {
      return emptyEvolutionArchive();
    }
    return { version: EVOLUTION_ARCHIVE_VERSION, runs: parsed.runs as EvolutionRunLog[] };
  } catch {
    return emptyEvolutionArchive();
  }
}
