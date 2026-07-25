import {
  pointInsideBreach,
  type BuildingBreach,
} from './breaching';
import {
  segmentObstacleIntersection,
  type ArenaObstacle,
  type SpatialPoint,
} from './physics';

export type OccludingObstacle = ArenaObstacle & {
  height?: number;
};

export function effectBlockedByCover<T extends OccludingObstacle>(
  from: SpatialPoint,
  target: SpatialPoint,
  obstacles: readonly T[],
  breachesForObstacle: (obstacle: T) => readonly BuildingBreach[] = () => [],
  breachRadius = 0,
  targetHeightOffset = 0.85,
) {
  const sourceHeight = from.y ?? 0.14;
  const targetHeight = (target.y ?? 0) + targetHeightOffset;
  return obstacles.some((obstacle) => {
    const intersection = segmentObstacleIntersection(from, target, obstacle);
    if (!intersection) return false;
    const midpoint = (intersection.near + intersection.far) / 2;
    const nearHeight = sourceHeight
      + (targetHeight - sourceHeight) * intersection.near;
    const farHeight = sourceHeight
      + (targetHeight - sourceHeight) * intersection.far;
    const intersectionPoint = {
      x: from.x + (target.x - from.x) * midpoint,
      y: sourceHeight + (targetHeight - sourceHeight) * midpoint,
      z: from.z + (target.z - from.z) * midpoint,
    };
    if (
      typeof obstacle.height === 'number'
      && Math.min(nearHeight, farHeight) > obstacle.height
    ) {
      return false;
    }
    const passesThroughBreach = breachRadius > 0
      && breachesForObstacle(obstacle).some((breach) => (
        pointInsideBreach(intersectionPoint, breach, breachRadius)
      ));
    return !passesThroughBreach;
  });
}
