import {
  ENEMY_ROLES,
  specialistProfile,
  type EnemyRole,
  type SpecialistProfile,
} from './enemyAi';
import type { RandomSource } from '../simulation/random';

export const ENEMY_MUTATION_RATE = 0.3;
export const ENEMY_MUTATION_STRENGTH = 0.065;
export const ADAPTIVE_MUTATION_RATE = 0.5;
export const ADAPTIVE_MUTATION_STRENGTH = 0.12;
export const NORMAL_BUDGET_GAIN = 0.14;
export const ADAPTIVE_BUDGET_GAIN = 0.22;
export const MAX_COMBAT_GENE_BUDGET = 8.55;

export type EnemyGene = keyof SpecialistProfile;

export type EnemyGenome = {
  id: string;
  role: EnemyRole;
  generation: number;
  parentIds: string[];
  genes: SpecialistProfile;
};

export type ScoredEnemyGenome = {
  genome: EnemyGenome;
  fitness: number;
};

export type EnemyEvolutionResult = {
  genomes: EnemyGenome[];
  mutationPercent: number;
  parentIds: string[];
  adaptiveMutation: boolean;
  configuredMutationRate: number;
};

export type EnemyEvolutionOptions = {
  adaptiveMutation?: boolean;
};

export const GENE_KEYS: EnemyGene[] = [
  'speed',
  'accuracy',
  'fireInterval',
  'aggression',
  'predictionLead',
  'projectileSpeed',
  'coverDiscipline',
  'evasion',
  'navigation',
];

export const GENE_BOUNDS: Record<EnemyGene, { min: number; max: number; lowerIsBetter?: boolean }> = {
  speed: { min: 2.4, max: 6.8 },
  accuracy: { min: 0.28, max: 0.96 },
  fireInterval: { min: 0.72, max: 2.6, lowerIsBetter: true },
  aggression: { min: 0.38, max: 1 },
  predictionLead: { min: 0.25, max: 1.6 },
  projectileSpeed: { min: 16, max: 32 },
  coverDiscipline: { min: 0.2, max: 1 },
  evasion: { min: 0.18, max: 1 },
  navigation: { min: 0.3, max: 1 },
};

const ROLE_CORE_GENES: Record<EnemyRole, EnemyGene[]> = {
  marksman: ['accuracy', 'predictionLead', 'projectileSpeed'],
  sprinter: ['speed', 'fireInterval', 'aggression'],
  dodger: ['evasion', 'speed', 'navigation'],
  navigator: ['navigation', 'coverDiscipline', 'speed'],
  artillery: ['predictionLead', 'coverDiscipline', 'accuracy'],
  interceptor: ['navigation', 'predictionLead', 'aggression'],
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const createGenomeId = (role: EnemyRole, generation: number, rng: RandomSource) => (
  `${role.slice(0, 3).toUpperCase()}-${generation}-${rng.int(1000, 9999)}`
);

const normalizedGene = (gene: EnemyGene, value: number) => {
  const bounds = GENE_BOUNDS[gene];
  const normalized = (clamp(value, bounds.min, bounds.max) - bounds.min) / (bounds.max - bounds.min);
  return bounds.lowerIsBetter ? 1 - normalized : normalized;
};

const geneFromNormalized = (gene: EnemyGene, normalized: number) => {
  const bounds = GENE_BOUNDS[gene];
  const effective = clamp(normalized, 0, 1);
  const rawNormalized = bounds.lowerIsBetter ? 1 - effective : effective;
  return clamp(bounds.min + rawNormalized * (bounds.max - bounds.min), bounds.min, bounds.max);
};

export function enemyGenomeBudget(genome: EnemyGenome | SpecialistProfile) {
  const genes = 'genes' in genome ? genome.genes : genome;
  return GENE_KEYS.reduce((sum, gene) => sum + normalizedGene(gene, genes[gene]), 0);
}

const rebalanceGenes = (
  genes: SpecialistProfile,
  role: EnemyRole,
  targetBudget: number,
  rng: RandomSource,
) => {
  const coreGenes = ROLE_CORE_GENES[role];
  for (let iteration = 0; iteration < 500; iteration += 1) {
    const budget = enemyGenomeBudget(genes);
    const difference = targetBudget - budget;
    if (Math.abs(difference) < 0.0001) break;
    const increasing = difference > 0;
    const preferred = increasing
      ? coreGenes.filter((gene) => normalizedGene(gene, genes[gene]) < 0.9999)
      : GENE_KEYS.filter((gene) => !coreGenes.includes(gene) && normalizedGene(gene, genes[gene]) > 0.0001);
    const fallback = GENE_KEYS.filter((gene) => {
      const normalized = normalizedGene(gene, genes[gene]);
      return increasing ? normalized < 0.9999 : normalized > 0.0001;
    });
    const candidates = preferred.length > 0 && rng.chance(0.72) ? preferred : fallback;
    if (candidates.length === 0) break;
    const gene = rng.pick(candidates);
    const current = normalizedGene(gene, genes[gene]);
    const step = Math.min(Math.abs(difference), increasing ? 1 - current : current);
    genes[gene] = geneFromNormalized(gene, current + Math.sign(difference) * step);
  }
};

export function createFounderEnemyGenomes(rng: RandomSource): EnemyGenome[] {
  return ENEMY_ROLES.map((role) => ({
    id: createGenomeId(role, 1, rng),
    role,
    generation: 1,
    parentIds: [],
    genes: specialistProfile(role),
  }));
}

export function enemyGenomeStrength(genome: EnemyGenome) {
  const { genes } = genome;
  return genes.speed
    + genes.accuracy * 4
    + (GENE_BOUNDS.fireInterval.max - genes.fireInterval) * 1.4
    + genes.aggression * 2
    + genes.predictionLead * 1.2
    + (genes.projectileSpeed - GENE_BOUNDS.projectileSpeed.min) * 0.18
    + genes.coverDiscipline * 1.4
    + genes.evasion * 1.6
    + genes.navigation * 1.4;
}

export function evolveEnemyGenomes(
  scored: readonly ScoredEnemyGenome[],
  rng: RandomSource,
  generation: number,
  options: EnemyEvolutionOptions = {},
): EnemyEvolutionResult {
  if (scored.length !== ENEMY_ROLES.length) {
    throw new Error(`Enemy evolution requires exactly ${ENEMY_ROLES.length} scored genomes.`);
  }

  const ranked = [...scored].sort((first, second) => second.fitness - first.fitness);
  const donorPool = ranked.slice(0, 3);
  const adaptiveMutation = options.adaptiveMutation ?? false;
  const mutationRate = adaptiveMutation ? ADAPTIVE_MUTATION_RATE : ENEMY_MUTATION_RATE;
  const mutationStrength = adaptiveMutation ? ADAPTIVE_MUTATION_STRENGTH : ENEMY_MUTATION_STRENGTH;
  const budgetGain = adaptiveMutation ? ADAPTIVE_BUDGET_GAIN : NORMAL_BUDGET_GAIN;
  let mutationCount = 0;

  const genomes = ENEMY_ROLES.map((role, roleIndex) => {
    const lineage = scored.find((entry) => entry.genome.role === role);
    if (!lineage) throw new Error(`Missing ${role} lineage during enemy evolution.`);

    const availableDonors = donorPool.filter((entry) => entry.genome.id !== lineage.genome.id);
    const donor = availableDonors.length > 0
      ? availableDonors[roleIndex % availableDonors.length]
      : ranked.find((entry) => entry.genome.id !== lineage.genome.id) ?? lineage;
    const genes = { ...lineage.genome.genes };
    let childMutations = 0;

    for (const gene of GENE_KEYS) {
      const lineageValue = lineage.genome.genes[gene];
      const donorValue = donor.genome.genes[gene];
      genes[gene] = rng.chance(0.56)
        ? donorValue
        : rng.chance(0.18)
          ? (lineageValue + donorValue) / 2
          : lineageValue;

      if (rng.chance(mutationRate)) {
        const current = normalizedGene(gene, genes[gene]);
        const mutated = geneFromNormalized(gene, current + rng.range(-mutationStrength, mutationStrength));
        if (Math.abs(mutated - genes[gene]) > 0.000001) {
          genes[gene] = mutated;
          mutationCount += 1;
          childMutations += 1;
        }
      }
    }

    if (childMutations === 0) {
      const gene = rng.pick(GENE_KEYS);
      const current = normalizedGene(gene, genes[gene]);
      genes[gene] = geneFromNormalized(gene, current + rng.range(-mutationStrength, mutationStrength));
      mutationCount += 1;
    }

    const targetBudget = Math.min(
      MAX_COMBAT_GENE_BUDGET,
      enemyGenomeBudget(lineage.genome) + budgetGain,
    );
    rebalanceGenes(genes, role, targetBudget, rng);

    return {
      id: createGenomeId(role, generation, rng),
      role,
      generation,
      parentIds: Array.from(new Set([lineage.genome.id, donor.genome.id])),
      genes,
    };
  });

  return {
    genomes,
    mutationPercent: Math.round((mutationCount / (genomes.length * GENE_KEYS.length)) * 100),
    parentIds: donorPool.map((entry) => entry.genome.id),
    adaptiveMutation,
    configuredMutationRate: mutationRate,
  };
}
