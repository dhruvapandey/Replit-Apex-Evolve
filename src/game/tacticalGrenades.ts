import type { XzPoint } from './physics';

export const SMOKE_GRENADES_PER_GENERATION = 2;
export const FLASH_GRENADES_PER_GENERATION = 2;
export const TACTICAL_GRENADE_RANGE = 32;
export const SMOKE_RADIUS = 6.5;
export const SMOKE_DURATION = 8;
export const FLASH_RADIUS = 9;
export const FLASH_DURATION = 5;
export const ENEMY_FLASH_DURATION_MULTIPLIER = 0.5;
export const ENEMY_TACTICAL_GRENADE_RANGE = 132;

export type SmokeZoneLike = {
  center: XzPoint;
  radius: number;
};

export type TimedSmokeZoneLike = SmokeZoneLike & {
  life: number;
  enemy: boolean;
};

function distanceFromSegment(point: XzPoint, from: XzPoint, to: XzPoint) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= 0.000001) return Math.hypot(point.x - from.x, point.z - from.z);
  const amount = Math.max(0, Math.min(1, (
    (point.x - from.x) * dx + (point.z - from.z) * dz
  ) / lengthSquared));
  const nearestX = from.x + dx * amount;
  const nearestZ = from.z + dz * amount;
  return Math.hypot(point.x - nearestX, point.z - nearestZ);
}

export function lineBlockedBySmoke(
  from: XzPoint,
  to: XzPoint,
  zones: readonly SmokeZoneLike[],
) {
  return zones.some((zone) => (
    distanceFromSegment(zone.center, from, to) <= zone.radius
  ));
}

export function enemySmokeExposureSeconds(
  player: XzPoint,
  zones: readonly TimedSmokeZoneLike[],
  blockedByCover: (zone: TimedSmokeZoneLike) => boolean = () => false,
) {
  return zones.reduce((remaining, zone) => {
    if (!zone.enemy || zone.life <= 0 || blockedByCover(zone)) return remaining;
    const distance = Math.hypot(
      player.x - zone.center.x,
      player.z - zone.center.z,
    );
    return distance <= zone.radius ? Math.max(remaining, zone.life) : remaining;
  }, 0);
}

export function flashBlindDuration(distance: number, blockedByCover: boolean) {
  if (blockedByCover || distance > FLASH_RADIUS) return 0;
  const falloff = Math.max(0, Math.min(1, distance / FLASH_RADIUS));
  return FLASH_DURATION * (1 - falloff * 0.36);
}

export function clampTacticalThrowDistance(distance: number) {
  return Math.max(0, Math.min(TACTICAL_GRENADE_RANGE, distance));
}

export function chooseTacticalCarrierIndex(random: number, enemyCount: number) {
  if (enemyCount <= 0) return -1;
  const normalized = Math.max(0, Math.min(0.999999, random));
  return Math.floor(normalized * enemyCount);
}
