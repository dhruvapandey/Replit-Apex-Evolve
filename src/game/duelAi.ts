import { PLAYER_CANNON_FIRE_INTERVAL } from './combat';
import type { XzPoint } from './physics';

export const DUEL_MIN_DISTANCE = 18;
export const DUEL_DODGE_CHANCE = 0.35;
export const DUEL_DODGE_DETECTION_RANGE = 10;
export const DUEL_DODGE_REACTION_SECONDS = 0.25;
export const DUEL_DODGE_DISTANCE = 4.5;
export const DUEL_ROUND_ONE_AVERAGE_FIRE_INTERVAL = 0.5;
export const DUEL_LATERAL_PRESSURE_DISTANCE = 7;
export const DUEL_COMBAT_MEMORY_SECONDS = 2;
export const DUEL_BASE_PROJECTILE_SPEED = 21;
export const DUEL_BASE_MOVEMENT_SPEED = 6.56;
export const DUEL_TACTICAL_GRENADE_RANGE = 64;

export type DuelMovementIntent = 'retreat' | 'pressure' | 'intercept';

const DUEL_STARTING_AGGRESSION = 0.78;
const DUEL_FIRE_JITTER_SCALE = (
  2 * (DUEL_ROUND_ONE_AVERAGE_FIRE_INTERVAL - PLAYER_CANNON_FIRE_INTERVAL)
) / (1.05 - DUEL_STARTING_AGGRESSION * 0.55);

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function duelEnemyCannonCooldown(
  randomValue: number,
  power: number,
  aggression: number,
  distanceMultiplier = 1,
  bridgeMultiplier = 1,
) {
  const effectivePower = Math.max(1, power);
  const baseInterval = PLAYER_CANNON_FIRE_INTERVAL
    * Math.max(0, distanceMultiplier)
    * Math.max(0, bridgeMultiplier)
    / effectivePower;
  const maximumJitter = Math.max(0, 1.05 - clamp01(aggression) * 0.55)
    * DUEL_FIRE_JITTER_SCALE
    / effectivePower;
  return baseInterval + clamp01(randomValue) * maximumJitter;
}

export function duelBurstSize(randomValue: number) {
  return clamp01(randomValue) < 0.5 ? 2 : 3;
}

export function duelShouldDodge(randomValue: number) {
  return clamp01(randomValue) < DUEL_DODGE_CHANCE;
}

export function duelMovementIntent(
  distance: number,
  hasLineOfSight: boolean,
  cannonInRange: boolean,
): DuelMovementIntent {
  if (distance < DUEL_MIN_DISTANCE) return 'retreat';
  if (hasLineOfSight && cannonInRange) return 'pressure';
  return 'intercept';
}

export function registerDuelDodgeConsideration(
  consideredBy: readonly string[] | undefined,
  enemyId: string,
) {
  if (consideredBy?.includes(enemyId)) {
    return { firstConsideration: false, consideredBy: [...consideredBy] };
  }
  return {
    firstConsideration: true,
    consideredBy: [...(consideredBy ?? []), enemyId],
  };
}

export function clampDuelGoalDistance(
  goal: XzPoint,
  player: XzPoint,
  minimumDistance = DUEL_MIN_DISTANCE,
): XzPoint {
  const x = goal.x - player.x;
  const z = goal.z - player.z;
  const distance = Math.hypot(x, z);
  if (distance >= minimumDistance) return { x: goal.x, z: goal.z };
  if (distance < 0.0001) return { x: player.x + minimumDistance, z: player.z };
  const scale = minimumDistance / distance;
  return {
    x: player.x + x * scale,
    z: player.z + z * scale,
  };
}

export function duelLateralPressureGoal(
  enemy: XzPoint,
  player: XzPoint,
  side: number,
  lateralDistance = DUEL_LATERAL_PRESSURE_DISTANCE,
): XzPoint {
  const x = enemy.x - player.x;
  const z = enemy.z - player.z;
  const currentDistance = Math.hypot(x, z);
  const radius = Math.max(DUEL_MIN_DISTANCE, currentDistance);
  const startingAngle = currentDistance < 0.0001 ? 0 : Math.atan2(z, x);
  const direction = side < 0 ? -1 : 1;
  const angularStep = Math.min(Math.PI / 3, Math.max(0, lateralDistance) / radius);
  const angle = startingAngle + angularStep * direction;
  return {
    x: player.x + Math.cos(angle) * radius,
    z: player.z + Math.sin(angle) * radius,
  };
}
