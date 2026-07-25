import type { CoverBlock } from './arenas';
import type { XzPoint } from './physics';

export const RAMP_APPROACH_LENGTH = 10;
export const RAMP_ROOF_CLEARANCE = 0.85;
export const RAMP_TANK_CLEARANCE_RADIUS = 1.45;

export type RampOverpass = {
  coverIndex: number;
  centerX: number;
  centerZ: number;
  buildingWidth: number;
  buildingDepth: number;
  buildingHeight: number;
  laneWidth: number;
  approachLength: number;
  topHeight: number;
};

export type RampMovementDecision = {
  allowed: boolean;
  elevation: number;
  activeCoverIndex?: number;
};

export function createRampOverpass(coverIndex: number, cover: CoverBlock): RampOverpass {
  const [centerX, centerZ, buildingWidth, buildingHeight, buildingDepth] = cover;
  return {
    coverIndex,
    centerX,
    centerZ,
    buildingWidth,
    buildingDepth,
    buildingHeight,
    laneWidth: Math.max(3.2, buildingDepth - 0.8),
    approachLength: RAMP_APPROACH_LENGTH,
    topHeight: buildingHeight + RAMP_ROOF_CLEARANCE,
  };
}

export function rampElevationAt(point: XzPoint, ramps: readonly RampOverpass[]) {
  let elevation = 0;
  ramps.forEach((ramp) => {
    if (Math.abs(point.z - ramp.centerZ) > ramp.laneWidth / 2) return;
    const buildingMinX = ramp.centerX - ramp.buildingWidth / 2;
    const buildingMaxX = ramp.centerX + ramp.buildingWidth / 2;
    const rampMinX = buildingMinX - ramp.approachLength;
    const rampMaxX = buildingMaxX + ramp.approachLength;
    if (point.x < rampMinX || point.x > rampMaxX) return;
    let height = ramp.topHeight;
    if (point.x < buildingMinX) {
      height = ((point.x - rampMinX) / ramp.approachLength) * ramp.topHeight;
    } else if (point.x > buildingMaxX) {
      height = ((rampMaxX - point.x) / ramp.approachLength) * ramp.topHeight;
    }
    elevation = Math.max(elevation, height);
  });
  return elevation;
}

function pointInsideRampFootprint(point: XzPoint, ramp: RampOverpass) {
  const buildingMinX = ramp.centerX - ramp.buildingWidth / 2;
  const buildingMaxX = ramp.centerX + ramp.buildingWidth / 2;
  return point.x >= buildingMinX - ramp.approachLength
    && point.x <= buildingMaxX + ramp.approachLength
    && Math.abs(point.z - ramp.centerZ) <= ramp.laneWidth / 2;
}

export function rampMovementDecision(
  from: XzPoint,
  to: XzPoint,
  activeCoverIndex: number | undefined,
  ramps: readonly RampOverpass[],
): RampMovementDecision {
  const activeRamp = ramps.find((ramp) => ramp.coverIndex === activeCoverIndex);
  if (activeRamp) {
    if (pointInsideRampFootprint(to, activeRamp)) {
      return {
        allowed: true,
        elevation: rampElevationAt(to, [activeRamp]),
        activeCoverIndex: activeRamp.coverIndex,
      };
    }
    const buildingMinX = activeRamp.centerX - activeRamp.buildingWidth / 2;
    const buildingMaxX = activeRamp.centerX + activeRamp.buildingWidth / 2;
    const rampMinX = buildingMinX - activeRamp.approachLength;
    const rampMaxX = buildingMaxX + activeRamp.approachLength;
    const exitsThroughEnd = (to.x < rampMinX || to.x > rampMaxX)
      && Math.abs(to.z - activeRamp.centerZ) <= activeRamp.laneWidth / 2;
    return exitsThroughEnd
      ? { allowed: true, elevation: 0 }
      : {
        allowed: false,
        elevation: rampElevationAt(from, [activeRamp]),
        activeCoverIndex: activeRamp.coverIndex,
      };
  }

  const enteredRamp = ramps.find((ramp) => pointInsideRampFootprint(to, ramp));
  if (!enteredRamp) return { allowed: true, elevation: 0 };
  const buildingMinX = enteredRamp.centerX - enteredRamp.buildingWidth / 2;
  const buildingMaxX = enteredRamp.centerX + enteredRamp.buildingWidth / 2;
  const rampMinX = buildingMinX - enteredRamp.approachLength;
  const rampMaxX = buildingMaxX + enteredRamp.approachLength;
  const entersFromLeft = from.x < rampMinX
    && to.x >= rampMinX
    && to.x > from.x;
  const entersFromRight = from.x > rampMaxX
    && to.x <= rampMaxX
    && to.x < from.x;
  if (!entersFromLeft && !entersFromRight) return { allowed: false, elevation: 0 };
  return {
    allowed: true,
    elevation: rampElevationAt(to, [enteredRamp]),
    activeCoverIndex: enteredRamp.coverIndex,
  };
}

export function rampClearsBuilding(
  point: XzPoint,
  elevation: number,
  coverIndex: number,
  ramps: readonly RampOverpass[],
) {
  return ramps.some((ramp) => (
    ramp.coverIndex === coverIndex
    && Math.abs(point.z - ramp.centerZ) <= ramp.laneWidth / 2
    // The physics collider uses a 1.45-unit tank radius. Begin ignoring the
    // building when the tank's front reaches the roof, rather than waiting for
    // the tank's center to cross the wall plane.
    && point.x >= ramp.centerX - ramp.buildingWidth / 2 - RAMP_TANK_CLEARANCE_RADIUS
    && point.x <= ramp.centerX + ramp.buildingWidth / 2 + RAMP_TANK_CLEARANCE_RADIUS
    && elevation >= ramp.buildingHeight + 0.05
  ));
}
