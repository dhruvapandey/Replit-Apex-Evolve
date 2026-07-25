import { describe, expect, it } from 'vitest';
import {
  DUEL_ENEMIES_PER_ROUND,
  DUEL_ENEMY_POWER_CAP,
  DUEL_PLAYER_POWER_CAP,
  DUEL_STARTING_LIVES,
  duelEnemyPower,
  duelPlayerPower,
  enemyCountForMode,
  usesGeneticEvolution,
} from './combatMode';

describe('1v1 duel mode', () => {
  it('spawns exactly one equally powered opponent in round one', () => {
    expect(DUEL_ENEMIES_PER_ROUND).toBe(1);
    expect(DUEL_STARTING_LIVES).toBe(5);
    expect(enemyCountForMode('duel')).toBe(1);
    expect(duelPlayerPower(1)).toBe(1);
    expect(duelEnemyPower(1)).toBe(1);
  });

  it('upgrades the player by five percent and the enemy by ten percent each round', () => {
    expect(duelPlayerPower(2)).toBe(1.05);
    expect(duelPlayerPower(3)).toBe(1.1);
    expect(duelEnemyPower(2)).toBe(1.1);
    expect(duelEnemyPower(3)).toBe(1.2);
  });

  it('does not use genetic evolution', () => {
    expect(usesGeneticEvolution('duel')).toBe(false);
    expect(usesGeneticEvolution('evolution')).toBe(true);
  });

  it('caps very long matches to prevent runaway projectile spam', () => {
    expect(duelPlayerPower(100)).toBe(DUEL_PLAYER_POWER_CAP);
    expect(duelEnemyPower(100)).toBe(DUEL_ENEMY_POWER_CAP);
  });
});
