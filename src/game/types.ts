export type ToolType = 'inspect' | 'food' | 'poison' | 'wall' | 'predator' | 'erase';

export type SimulationStatus = 'design' | 'running' | 'paused' | 'complete';

export type DeathCause = 'starvation' | 'poison' | 'predator' | null;

export interface Genome {
  id: string;
  generation: number;
  parentIds: string[];
  foodAttraction: number;
  poisonAvoidance: number;
  predatorAvoidance: number;
  wander: number;
  speed: number;
  vision: number;
  size: number;
  energyEfficiency: number;
}

export interface CreatureSnapshot {
  id: string;
  generation: number;
  alive: boolean;
  health: number;
  energy: number;
  fitness: number;
  foodEaten: number;
  ageSeconds: number;
  genome: Genome;
  traits: string[];
  state: string;
  parentIds: string[];
  deathCause: DeathCause;
}

export interface GenerationSummary {
  generation: number;
  population: number;
  survivors: number;
  totalFoodEaten: number;
  bestFitness: number;
  averageFitness: number;
  bestFoodCount: number;
  bestCreatureId: string | null;
  parentIds: string[];
  improvementFromPrevious: number | null;
}

export interface LeaderSnapshot {
  id: string;
  rank: number;
  fitness: number;
  foodEaten: number;
  alive: boolean;
  state: string;
}

export interface ArenaObjectCounts {
  food: number;
  poison: number;
  wall: number;
  predator: number;
}

export interface ArenaRulesState {
  challengeLevel: number;
  foodRequired: number;
  budgetUsed: number;
  pressureUsed: number;
  pressureRequired: number;
  budgetMax: number;
  counts: ArenaObjectCounts;
  limits: ArenaObjectCounts;
  canStart: boolean;
  message: string;
}

export interface UiState {
  generation: number;
  status: SimulationStatus;
  timeLeftSeconds: number;
  totalFoodEaten: number;
  objectiveTarget: number;
  speedMultiplier: number;
  selectedTool: ToolType;
  aliveCreatures: number;
  trailsEnabled: boolean;
  leaders: LeaderSnapshot[];
  arenaRules: ArenaRulesState;
}
