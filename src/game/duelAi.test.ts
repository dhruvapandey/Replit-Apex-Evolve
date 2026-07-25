import { describe, expect, it } from 'vitest';
import { PLAYER_CANNON_FIRE_INTERVAL } from './combat';
import {
  DUEL_BASE_MOVEMENT_SPEED,
  DUEL_BASE_PROJECTILE_SPEED,
  DUEL_COMBAT_MEMORY_SECONDS,
  DUEL_DODGE_CHANCE,
  DUEL_LATERAL_PRESSURE_DISTANCE,
  DUEL_MIN_DISTANCE,
  DUEL_ROUND_ONE_AVERAGE_FIRE_INTERVAL,
  DUEL_TACTICAL_GRENADE_RANGE,
  clampDuelGoalDistance,
  duelBurstSize,
  duelEnemyCannonCooldown,
  duelLateralPressureGoal,
  duelMovementIntent,
  duelShouldDodge,
  registerDuelDodgeConsideration,
} from './duelAi';

describe('1v1 Duel offensive balance', () => {
  it('starts at an exact 0.500-second theoretical average cannon interval', () => {
    const minimum = duelEnemyCannonCooldown(0, 1, 0.78);
    const average = duelEnemyCannonCooldown(0.5, 1, 0.78);
    const maximum = duelEnemyCannonCooldown(1, 1, 0.78);

    expect(minimum).toBeCloseTo(PLAYER_CANNON_FIRE_INTERVAL);
    expect(average).toBeCloseTo(DUEL_ROUND_ONE_AVERAGE_FIRE_INTERVAL);
    expect(maximum).toBeCloseTo(0.7846153846);
  });

  it('accelerates the complete cooldown with Duel enemy power', () => {
    expect(duelEnemyCannonCooldown(0.5, 2, 0.78)).toBeCloseTo(0.25);
  });

  it('uses the reduced opponent starting mobility and tactical values', () => {
    expect(DUEL_BASE_MOVEMENT_SPEED).toBeCloseTo(6.56);
    expect(DUEL_BASE_PROJECTILE_SPEED).toBe(21);
    expect(DUEL_COMBAT_MEMORY_SECONDS).toBe(2);
    expect(DUEL_TACTICAL_GRENADE_RANGE).toBe(64);
  });

  it('fires controlled bursts of two or three shells', () => {
    expect(duelBurstSize(0)).toBe(2);
    expect(duelBurstSize(0.49)).toBe(2);
    expect(duelBurstSize(0.5)).toBe(3);
    expect(duelBurstSize(1)).toBe(3);
  });

  it('uses a thirty-five percent dodge roll', () => {
    expect(DUEL_DODGE_CHANCE).toBe(0.35);
    expect(duelShouldDodge(0.34)).toBe(true);
    expect(duelShouldDodge(0.35)).toBe(false);
  });

  it('allows only one dodge consideration for each shell', () => {
    const first = registerDuelDodgeConsideration(undefined, 'rival');
    const repeated = registerDuelDodgeConsideration(first.consideredBy, 'rival');
    expect(first.firstConsideration).toBe(true);
    expect(repeated.firstConsideration).toBe(false);
    expect(repeated.consideredBy).toEqual(['rival']);
  });

  it('clamps voluntary movement outside the point-blank floor', () => {
    expect(clampDuelGoalDistance({ x: 4, z: 0 }, { x: 0, z: 0 }))
      .toEqual({ x: DUEL_MIN_DISTANCE, z: 0 });
    expect(clampDuelGoalDistance({ x: 25, z: 5 }, { x: 0, z: 0 }))
      .toEqual({ x: 25, z: 5 });
  });

  it('strafes around a visible player without closing the current distance', () => {
    const enemy = { x: 30, z: 0 };
    const player = { x: 0, z: 0 };
    const goal = duelLateralPressureGoal(enemy, player, 1);

    expect(DUEL_LATERAL_PRESSURE_DISTANCE).toBe(7);
    expect(Math.hypot(goal.x - player.x, goal.z - player.z)).toBeCloseTo(30);
    expect(goal.z).toBeGreaterThan(0);
    expect(goal).not.toEqual(enemy);
  });

  it('turns a point-blank pressure goal into a retreating lateral move', () => {
    const goal = duelLateralPressureGoal(
      { x: 4, z: 0 },
      { x: 0, z: 0 },
      -1,
    );
    expect(Math.hypot(goal.x, goal.z)).toBeCloseTo(DUEL_MIN_DISTANCE);
    expect(goal.z).toBeLessThan(0);
  });

  it('does not choose bridge interception with a valid elevated firing line', () => {
    expect(duelMovementIntent(42, true, true)).toBe('pressure');
    expect(duelMovementIntent(42, false, true)).toBe('intercept');
    expect(duelMovementIntent(42, true, false)).toBe('intercept');
    expect(duelMovementIntent(12, true, true)).toBe('retreat');
  });
});
