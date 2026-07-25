import type { ArenaObstacle, XzPoint } from './physics';

export function distanceToObstacle(point: XzPoint, obstacle: ArenaObstacle) {
  const x = Math.max(obstacle.minX, Math.min(obstacle.maxX, point.x));
  const z = Math.max(obstacle.minZ, Math.min(obstacle.maxZ, point.z));
  return Math.hypot(point.x - x, point.z - z);
}

export function blastDamageForObstacle(
  point: XzPoint,
  obstacle: ArenaObstacle,
  radius: number,
  maximumDamage: number,
) {
  if (radius <= 0 || maximumDamage <= 0) return 0;
  const distance = distanceToObstacle(point, obstacle);
  if (distance > radius) return 0;
  return maximumDamage * (0.28 + 0.72 * (1 - distance / radius));
}
