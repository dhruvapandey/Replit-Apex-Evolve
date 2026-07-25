export type XzPoint = { x: number; z: number };
export type SpatialPoint = XzPoint & { y?: number };

export type ArenaObstacle = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export function tankPositionBlocked(
  position: XzPoint,
  obstacles: ArenaObstacle[],
  radius = 1.45,
) {
  return obstacles.some((wall) => (
    position.x + radius > wall.minX
    && position.x - radius < wall.maxX
    && position.z + radius > wall.minZ
    && position.z - radius < wall.maxZ
  ));
}

export function projectileHitsObstacle(position: XzPoint, obstacles: ArenaObstacle[]) {
  return obstacles.some((wall) => (
    position.x >= wall.minX
    && position.x <= wall.maxX
    && position.z >= wall.minZ
    && position.z <= wall.maxZ
  ));
}

export function projectileHitsTank(projectile: SpatialPoint, tank: SpatialPoint, radius = 1.8) {
  const dx = projectile.x - tank.x;
  const dz = projectile.z - tank.z;
  const horizontalHit = dx * dx + dz * dz <= radius * radius;
  if (!horizontalHit) return false;
  const projectileY = 'y' in projectile && typeof projectile.y === 'number' ? projectile.y : undefined;
  const tankY = 'y' in tank && typeof tank.y === 'number' ? tank.y : undefined;
  if (projectileY === undefined || tankY === undefined) return true;
  return Math.abs(projectileY - (tankY + 0.85)) <= 1.25;
}

export type SegmentObstacleIntersection = {
  near: number;
  far: number;
};

export function segmentObstacleIntersection(
  from: XzPoint,
  to: XzPoint,
  wall: ArenaObstacle,
): SegmentObstacleIntersection | null {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  let near = 0;
  let far = 1;

  for (const [origin, direction, min, max] of [
    [from.x, dx, wall.minX, wall.maxX],
    [from.z, dz, wall.minZ, wall.maxZ],
  ]) {
    if (Math.abs(direction) < 0.00001) {
      if (origin < min || origin > max) return null;
      continue;
    }
    const first = (min - origin) / direction;
    const second = (max - origin) / direction;
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (near > far) return null;
  }
  if (far < 0 || near > 1) return null;
  return {
    near: Math.max(0, near),
    far: Math.min(1, far),
  };
}

export function lineOfSightBlocked(from: XzPoint, to: XzPoint, obstacles: ArenaObstacle[]) {
  return obstacles.some((wall) => segmentObstacleIntersection(from, to, wall) !== null);
}
