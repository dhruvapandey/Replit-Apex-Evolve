import { describe, expect, it } from 'vitest';
import {
  MORTAR_DIRECT_RADIUS,
  MORTAR_MAX_RANGE,
  MORTAR_RANGE_MULTIPLIER,
  MORTAR_SPLASH_RADIUS,
  ENEMY_GENERATION_FIRE_RATE_CAP,
  ENEMY_GENERATION_FIRE_RATE_GAIN,
  PLAYER_CANNON_FIRE_RATE_MULTIPLIER,
  PLAYER_CANNON_FIRE_INTERVAL,
  PLAYER_GENERATION_FIRE_RATE_CAP,
  PLAYER_GENERATION_FIRE_RATE_GAIN,
  PLAYER_MORTAR_GENERATION_POWER_CAP,
  PLAYER_MORTAR_GENERATION_POWER_GAIN,
  WOUNDED_SPEED_MULTIPLIER,
  enemyCannonCooldownForGeneration,
  enemyFireRateMultiplierForGeneration,
  mortarBlastDamage,
  mortarAimDistance,
  mortarBurstCount,
  mortarDistanceToArenaEdge,
  mortarFlightDuration,
  mortarLaunchSpeed,
  mortarRangeForElevation,
  mortarTacticalDistance,
  mortarTargetInsideArena,
  playerCannonFireIntervalForGeneration,
  playerFireRateMultiplierForGeneration,
  playerMortarPowerForGeneration,
} from './combat';

describe('mortar damage', () => {
  it('increases the player cannon firing rate by thirty percent', () => {
    expect(PLAYER_CANNON_FIRE_RATE_MULTIPLIER).toBe(1.3);
    expect(1 / PLAYER_CANNON_FIRE_INTERVAL).toBeCloseTo((1 / 0.28) * 1.3);
  });

  it('accelerates player cannon fire by ten percent every generation', () => {
    expect(PLAYER_GENERATION_FIRE_RATE_GAIN).toBe(0.1);
    expect(playerFireRateMultiplierForGeneration(1)).toBe(1);
    expect(playerFireRateMultiplierForGeneration(2)).toBeCloseTo(1.1);
    expect(playerFireRateMultiplierForGeneration(3)).toBeCloseTo(1.2);
    expect(playerCannonFireIntervalForGeneration(3)).toBeCloseTo(
      PLAYER_CANNON_FIRE_INTERVAL / 1.2,
    );
  });

  it('accelerates enemy cannon fire by five percent every generation', () => {
    expect(ENEMY_GENERATION_FIRE_RATE_GAIN).toBe(0.05);
    expect(enemyFireRateMultiplierForGeneration(1)).toBe(1);
    expect(enemyFireRateMultiplierForGeneration(2)).toBeCloseTo(1.05);
    expect(enemyFireRateMultiplierForGeneration(3)).toBeCloseTo(1.1);
    expect(enemyCannonCooldownForGeneration(2, 3)).toBeCloseTo(2 / 1.1);
  });

  it('increases Evolution mortar power by twenty percent per generation', () => {
    expect(PLAYER_MORTAR_GENERATION_POWER_GAIN).toBe(0.2);
    expect(playerMortarPowerForGeneration(1)).toBe(1);
    expect(playerMortarPowerForGeneration(2)).toBeCloseTo(1.2);
    expect(playerMortarPowerForGeneration(3)).toBeCloseTo(1.4);
    expect(playerMortarPowerForGeneration(5)).toBeCloseTo(1.8);
    expect(playerMortarPowerForGeneration(6)).toBe(PLAYER_MORTAR_GENERATION_POWER_CAP);
    expect(playerMortarPowerForGeneration(100)).toBe(PLAYER_MORTAR_GENERATION_POWER_CAP);
  });

  it('uses mechanical fire-rate caps to avoid runaway projectile spam', () => {
    expect(playerFireRateMultiplierForGeneration(30)).toBeCloseTo(3.9);
    expect(enemyFireRateMultiplierForGeneration(30)).toBeCloseTo(2.45);
    expect(playerFireRateMultiplierForGeneration(100)).toBe(PLAYER_GENERATION_FIRE_RATE_CAP);
    expect(enemyFireRateMultiplierForGeneration(100)).toBe(ENEMY_GENERATION_FIRE_RATE_CAP);
  });

  it('kills an enemy on direct impact', () => {
    expect(mortarBlastDamage(MORTAR_DIRECT_RADIUS, false)).toBe(2);
  });

  it('does not let even direct-radius blast damage pass through cover', () => {
    expect(mortarBlastDamage(0.5, true)).toBe(0);
  });

  it('removes half health inside the splash radius', () => {
    expect(mortarBlastDamage(3, false)).toBe(1);
  });

  it('lets cover block non-direct splash damage', () => {
    expect(mortarBlastDamage(3, true)).toBe(0);
  });

  it('does no damage outside the explosion radius', () => {
    expect(mortarBlastDamage(MORTAR_SPLASH_RADIUS + 0.01, false)).toBe(0);
  });

  it('uses the thirty-percent larger mortar splash radius', () => {
    expect(MORTAR_SPLASH_RADIUS).toBeCloseTo(5.85);
  });

  it('slows wounded enemies to fifty-five percent speed', () => {
    expect(WOUNDED_SPEED_MULTIPLIER).toBe(0.55);
  });

  it('queues a three-shell burst when the magazine is full', () => {
    expect(mortarBurstCount(3)).toBe(3);
  });

  it('uses only the rounds that remain in a partial magazine', () => {
    expect(mortarBurstCount(2)).toBe(2);
    expect(mortarBurstCount(1)).toBe(1);
    expect(mortarBurstCount(0)).toBe(0);
  });

  it('adds exactly thirty percent range to the original mortar envelope', () => {
    expect(MORTAR_RANGE_MULTIPLIER).toBe(1.3);
    expect(MORTAR_MAX_RANGE).toBeCloseTo(140.4);
  });

  it('provides enough flight time to cross the arena', () => {
    const longRangeFlight = mortarFlightDuration(MORTAR_MAX_RANGE);
    expect(longRangeFlight).toBeGreaterThan(mortarFlightDuration(54));
    expect(longRangeFlight).toBeLessThanOrEqual(5.5);
  });

  it('uses maximum range when the POV aim ray does not meet the ground', () => {
    expect(mortarAimDistance(null)).toBe(MORTAR_MAX_RANGE);
    expect(mortarAimDistance(null, 210)).toBe(210);
  });

  it('keeps precise POV ground targeting and clamps excessive distances', () => {
    expect(mortarAimDistance(72)).toBe(72);
    expect(mortarAimDistance(360)).toBe(MORTAR_MAX_RANGE);
  });

  it('maps the tactical screen edge to the full mortar range', () => {
    expect(mortarTacticalDistance(0, 1, 24)).toBe(MORTAR_MAX_RANGE);
    expect(mortarTacticalDistance(-1, 0, 24)).toBe(MORTAR_MAX_RANGE);
    expect(mortarTacticalDistance(0, 1, 24, 210)).toBe(210);
  });

  it('preserves precise tactical aiming near the reticle center', () => {
    expect(mortarTacticalDistance(0.1, -0.1, 24)).toBe(24);
  });

  it('keeps mortar landing points inside the arena', () => {
    expect(mortarTargetInsideArena(0, 13, 0, -108, 38)).toEqual({ x: 0, z: -51 });
    expect(mortarTargetInsideArena(30, -30, 80, -80, 38)).toEqual({ x: 8, z: -8 });
  });

  it('uses real projectile range across mortar elevation angles', () => {
    expect(mortarRangeForElevation(Math.PI / 4, 100)).toBeCloseTo(100);
    expect(mortarRangeForElevation(Math.PI * 75 / 180, 100)).toBeCloseTo(65);
    expect(mortarRangeForElevation(Math.PI / 2, 100)).toBe(0);
  });

  it('accounts for muzzle height while preserving the 45-degree maximum', () => {
    const speed = mortarLaunchSpeed(80, 1.2);
    expect(speed).toBeGreaterThan(0);
    expect(mortarRangeForElevation(Math.PI / 4, 80, 1.2)).toBeCloseTo(80);
    expect(mortarRangeForElevation(Math.PI * 75 / 180, 80, 1.2)).toBeCloseTo(52, 0);
  });

  it('finds the available firing distance to the arena wall', () => {
    expect(mortarDistanceToArenaEdge(0, 13, 0, -1, 38)).toBe(51);
    expect(mortarDistanceToArenaEdge(30, -30, 1, -1, 38)).toBeCloseTo(Math.hypot(8, 8));
  });
});
