import type { ArenaObstacle } from './physics';

export const BREACH_REQUIRED_HITS = 4;
export const BREACH_RADIUS = 0.72;
export const BREACH_GROUPING_RADIUS = 0.86;

export type BreachAxis = 'x' | 'z';
export type BreachPoint = { x: number; y: number; z: number };
export type BuildingBreach = { axis: BreachAxis; center: BreachPoint };
export type BreachProgress = BuildingBreach & { hits: number };

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.max(minimum, Math.min(maximum, value))
);

export function breachAxisForImpact(point: BreachPoint, obstacle: ArenaObstacle): BreachAxis {
  const xFaceDistance = Math.min(
    Math.abs(point.x - obstacle.minX),
    Math.abs(point.x - obstacle.maxX),
  );
  const zFaceDistance = Math.min(
    Math.abs(point.z - obstacle.minZ),
    Math.abs(point.z - obstacle.maxZ),
  );
  return xFaceDistance < zFaceDistance ? 'x' : 'z';
}

export function breachCenterForImpact(
  point: BreachPoint,
  obstacle: ArenaObstacle,
  buildingHeight: number,
  radius = BREACH_RADIUS,
): BuildingBreach {
  const axis = breachAxisForImpact(point, obstacle);
  const margin = radius + 0.18;
  const center = {
    x: axis === 'x'
      ? (obstacle.minX + obstacle.maxX) / 2
      : clamp(point.x, obstacle.minX + margin, obstacle.maxX - margin),
    y: clamp(point.y, margin, buildingHeight - margin),
    z: axis === 'z'
      ? (obstacle.minZ + obstacle.maxZ) / 2
      : clamp(point.z, obstacle.minZ + margin, obstacle.maxZ - margin),
  };
  return { axis, center };
}

export function pointInsideBreach(
  point: BreachPoint,
  breach: BuildingBreach,
  radius = BREACH_RADIUS,
) {
  if (breach.axis === 'x') {
    return Math.hypot(point.y - breach.center.y, point.z - breach.center.z) <= radius;
  }
  return Math.hypot(point.x - breach.center.x, point.y - breach.center.y) <= radius;
}

export function registerBreachHit(
  current: readonly BreachProgress[],
  candidate: BuildingBreach,
  groupingRadius = BREACH_GROUPING_RADIUS,
) {
  const progress = current.map((entry) => ({
    ...entry,
    center: { ...entry.center },
  }));
  const matching = progress.find((entry) => (
    entry.axis === candidate.axis
    && pointInsideBreach(candidate.center, entry, groupingRadius)
  ));

  if (!matching) {
    const started = { ...candidate, center: { ...candidate.center }, hits: 1 };
    return { progress: [...progress, started], completed: undefined, hits: 1 };
  }

  matching.hits += 1;
  if (matching.hits < BREACH_REQUIRED_HITS) {
    return { progress, completed: undefined, hits: matching.hits };
  }

  const completed: BuildingBreach = {
    axis: matching.axis,
    center: { ...matching.center },
  };
  return {
    progress: progress.filter((entry) => entry !== matching),
    completed,
    hits: BREACH_REQUIRED_HITS,
  };
}
