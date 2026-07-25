import { describe, expect, it } from 'vitest';
import { MORTAR_SPLASH_RADIUS } from './combat';
import {
  DEPLOYMENT_SECONDS,
  ENEMY_MORTAR_MAX_COOLDOWN,
  ENEMY_MORTAR_MIN_COOLDOWN,
  ENEMY_MORTAR_FREQUENCY_MULTIPLIER,
  ENEMY_MORTAR_RADIUS,
  ENEMY_ROLES,
  ENEMY_STARTING_POWER,
  canLaunchEnemyMortar,
  enemyCannonCooldownMultiplier,
  enemyCannonInRange,
  enemyCannonProjectileLife,
  enemyMortarCooldown,
  enemyMortarCooldownAtPower,
  enemyMortarHitsPlayer,
  enemyProfileAtPower,
  evolvedEnemyDodgesWeapon,
  interceptorBridgeFireMultiplier,
  predictPlayerPosition,
  roleDodgesWeapon,
  specialistProfile,
} from './enemyAi';

describe('enemy specialist squad', () => {
  it('contains exactly six roles and one artillery tank', () => {
    expect(ENEMY_ROLES).toHaveLength(6);
    expect(ENEMY_ROLES.filter((role) => role === 'artillery')).toHaveLength(1);
  });

  it('gives every specialist a distinct combat advantage', () => {
    const profiles = Object.fromEntries(ENEMY_ROLES.map((role) => [role, specialistProfile(role)]));
    expect(profiles.marksman.accuracy).toBeGreaterThan(profiles.navigator.accuracy);
    expect(profiles.sprinter.speed).toBeGreaterThan(profiles.dodger.speed);
    expect(profiles.artillery.predictionLead).toBeGreaterThan(profiles.marksman.predictionLead);
    expect(profiles.interceptor.projectileSpeed).toBeGreaterThan(profiles.marksman.projectileSpeed);
  });

  it('keeps the founder squad fixed at six specialists', () => {
    expect(ENEMY_ROLES).toHaveLength(6);
  });

  it('gives only the interceptor a bridge-fire cadence advantage', () => {
    expect(interceptorBridgeFireMultiplier('interceptor', true)).toBe(0.58);
    expect(interceptorBridgeFireMultiplier('interceptor', false)).toBe(1);
    expect(interceptorBridgeFireMultiplier('marksman', true)).toBe(1);
  });

  it('starts combat at 1.8x pressure without adding enemy health', () => {
    const base = specialistProfile('marksman');
    const powered = enemyProfileAtPower(base);
    expect(ENEMY_STARTING_POWER).toBe(1.8);
    expect(powered.fireInterval).toBe(base.fireInterval / 1.8);
    expect(1 - powered.accuracy).toBeCloseTo((1 - base.accuracy) / 1.8);
    expect(powered.speed).toBeCloseTo(base.speed * Math.sqrt(1.8));
    expect(powered.projectileSpeed).toBeCloseTo(base.projectileSpeed * Math.sqrt(1.8));
  });

  it('keeps the raw genetic profile unchanged at neutral power', () => {
    const base = specialistProfile('navigator');
    expect(enemyProfileAtPower(base, 1)).toEqual(base);
  });

  it('predicts and clamps the player position inside the arena', () => {
    expect(predictPlayerPosition({ x: 2, z: 3 }, { x: 4, z: -2 }, 0.5)).toEqual({ x: 4, z: 2 });
    expect(predictPlayerPosition({ x: 34, z: -34 }, { x: 20, z: -20 }, 1)).toEqual({ x: 35.5, z: -35.5 });
  });

  it('aims correctly throughout an expanded dual-sector arena', () => {
    const bounds = { minX: -85, maxX: 85, minZ: -38, maxZ: 38 };
    expect(predictPlayerPosition({ x: -47, z: 31 }, { x: 0, z: 0 }, 1, bounds))
      .toEqual({ x: -47, z: 31 });
    expect(predictPlayerPosition({ x: 80, z: 35 }, { x: 20, z: 20 }, 1, bounds))
      .toEqual({ x: 85, z: 38 });
  });

  it('keeps cannon pressure effective across the expanded city', () => {
    expect(enemyCannonInRange(105)).toBe(true);
    expect(enemyCannonInRange(113)).toBe(false);
    expect(enemyCannonProjectileLife(105, 24)).toBeGreaterThan(4);
    expect(enemyCannonCooldownMultiplier(45)).toBe(1);
    expect(enemyCannonCooldownMultiplier(105)).toBeGreaterThan(1.8);
  });

  it('lets only the dodger react to cannon bullets', () => {
    expect(roleDodgesWeapon('dodger', 'cannon')).toBe(true);
    expect(roleDodgesWeapon('dodger', 'mortar')).toBe(false);
    expect(roleDodgesWeapon('navigator', 'cannon')).toBe(false);
  });

  it('allows inherited evasion to unlock cannon dodging but never mortar dodging', () => {
    expect(evolvedEnemyDodgesWeapon('navigator', 'cannon', 0.71)).toBe(false);
    expect(evolvedEnemyDodgesWeapon('navigator', 'cannon', 0.72)).toBe(true);
    expect(evolvedEnemyDodgesWeapon('dodger', 'mortar', 1)).toBe(false);
  });
});

describe('enemy artillery balance', () => {
  it('uses a three-second deployment lock', () => {
    expect(DEPLOYMENT_SECONDS).toBe(3);
  });

  it('has a smaller blast than the player mortar', () => {
    expect(ENEMY_MORTAR_RADIUS).toBeLessThan(MORTAR_SPLASH_RADIUS);
  });

  it('keeps artillery cooldown between seven and nine seconds', () => {
    expect(enemyMortarCooldown(0)).toBe(ENEMY_MORTAR_MIN_COOLDOWN);
    expect(enemyMortarCooldown(1)).toBe(ENEMY_MORTAR_MAX_COOLDOWN);
  });

  it('halves powered artillery firing frequency', () => {
    expect(ENEMY_MORTAR_FREQUENCY_MULTIPLIER).toBe(0.5);
    expect(enemyMortarCooldownAtPower(0)).toBeCloseTo(
      ENEMY_MORTAR_MIN_COOLDOWN / (ENEMY_STARTING_POWER * 0.5),
    );
    expect(enemyMortarCooldownAtPower(1)).toBeCloseTo(
      ENEMY_MORTAR_MAX_COOLDOWN / (ENEMY_STARTING_POWER * 0.5),
    );
  });

  it('allows only one remembered artillery shot at a time', () => {
    expect(canLaunchEnemyMortar('artillery', 0, 0, 1)).toBe(true);
    expect(canLaunchEnemyMortar('artillery', 1, 0, 1)).toBe(false);
    expect(canLaunchEnemyMortar('marksman', 0, 0, 1)).toBe(false);
    expect(canLaunchEnemyMortar('artillery', 0, 0, 0)).toBe(false);
  });

  it('removes one life only inside the smaller artillery radius', () => {
    expect(enemyMortarHitsPlayer(ENEMY_MORTAR_RADIUS)).toBe(true);
    expect(enemyMortarHitsPlayer(ENEMY_MORTAR_RADIUS + 0.01)).toBe(false);
  });
});
