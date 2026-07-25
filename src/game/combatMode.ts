import { ENEMIES_PER_GENERATION } from './progression';

export type CombatMode = 'evolution' | 'duel';

export const DUEL_ENEMIES_PER_ROUND = 1;
export const DUEL_STARTING_LIVES = 5;
export const DUEL_PLAYER_UPGRADE_PER_ROUND = 0.05;
export const DUEL_ENEMY_UPGRADE_PER_ROUND = 0.1;
export const DUEL_PLAYER_POWER_CAP = 2.5;
export const DUEL_ENEMY_POWER_CAP = 4;

function roundPower(round: number, gain: number, cap: number) {
  const completedRounds = Math.max(0, Math.floor(round) - 1);
  return Math.min(cap, 1 + completedRounds * gain);
}

export function duelPlayerPower(round: number) {
  return roundPower(round, DUEL_PLAYER_UPGRADE_PER_ROUND, DUEL_PLAYER_POWER_CAP);
}

export function duelEnemyPower(round: number) {
  return roundPower(round, DUEL_ENEMY_UPGRADE_PER_ROUND, DUEL_ENEMY_POWER_CAP);
}

export function enemyCountForMode(mode: CombatMode) {
  return mode === 'duel' ? DUEL_ENEMIES_PER_ROUND : ENEMIES_PER_GENERATION;
}

export function usesGeneticEvolution(mode: CombatMode) {
  return mode === 'evolution';
}
