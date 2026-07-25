import { describe, expect, it } from 'vitest';
import {
  FLASH_DURATION,
  SMOKE_RADIUS,
  TACTICAL_GRENADE_RANGE,
  clampTacticalThrowDistance,
  chooseTacticalCarrierIndex,
  enemySmokeExposureSeconds,
  flashBlindDuration,
  lineBlockedBySmoke,
} from './tacticalGrenades';

describe('tactical grenades', () => {
  it('blocks an enemy sightline that crosses a smoke cloud', () => {
    const zones = [{ center: { x: 0, z: 0 }, radius: SMOKE_RADIUS }];
    expect(lineBlockedBySmoke({ x: -12, z: 0 }, { x: 12, z: 0 }, zones)).toBe(true);
    expect(lineBlockedBySmoke({ x: -12, z: 9 }, { x: 12, z: 9 }, zones)).toBe(false);
  });

  it('also conceals a tank positioned inside smoke', () => {
    const zones = [{ center: { x: 4, z: 3 }, radius: SMOKE_RADIUS }];
    expect(lineBlockedBySmoke({ x: 4, z: 3 }, { x: 20, z: 3 }, zones)).toBe(true);
  });

  it('reports remaining exposure only while the player is inside enemy smoke', () => {
    const zones = [
      { center: { x: 0, z: 0 }, radius: 6, life: 4.2, enemy: true },
      { center: { x: 0, z: 0 }, radius: 8, life: 7.5, enemy: false },
    ];
    expect(enemySmokeExposureSeconds({ x: 2, z: 1 }, zones)).toBe(4.2);
    expect(enemySmokeExposureSeconds({ x: 9, z: 0 }, zones)).toBe(0);
  });

  it('does not apply enemy smoke exposure through solid cover', () => {
    const zones = [
      { center: { x: 0, z: 0 }, radius: 6, life: 4.2, enemy: true },
    ];
    expect(enemySmokeExposureSeconds(
      { x: 2, z: 1 },
      zones,
      () => true,
    )).toBe(0);
  });

  it('blinds exposed nearby enemies but not tanks behind cover', () => {
    expect(flashBlindDuration(0, false)).toBe(FLASH_DURATION);
    expect(flashBlindDuration(6, false)).toBeGreaterThan(0);
    expect(flashBlindDuration(2, true)).toBe(0);
    expect(flashBlindDuration(20, false)).toBe(0);
  });

  it('caps aimed throws at the tactical grenade range', () => {
    expect(clampTacticalThrowDistance(18)).toBe(18);
    expect(clampTacticalThrowDistance(80)).toBe(TACTICAL_GRENADE_RANGE);
  });

  it('assigns exactly one deterministic carrier within the enemy squad', () => {
    expect(chooseTacticalCarrierIndex(0, 5)).toBe(0);
    expect(chooseTacticalCarrierIndex(0.52, 5)).toBe(2);
    expect(chooseTacticalCarrierIndex(0.999999, 5)).toBe(4);
    expect(chooseTacticalCarrierIndex(0.4, 0)).toBe(-1);
  });
});
