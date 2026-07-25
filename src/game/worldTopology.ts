import type { PlayableRect } from './arenas';
import type { XzPoint } from './physics';

export function pointInsideSurface(point: XzPoint, surface: PlayableRect, inset = 0) {
  const xInset = surface.kind === 'bridge' ? 0 : inset;
  const zInset = inset;
  return point.x >= surface.minX + xInset
    && point.x <= surface.maxX - xInset
    && point.z >= surface.minZ + zInset
    && point.z <= surface.maxZ - zInset;
}

export function positionOnPlayableSurface(
  point: XzPoint,
  surfaces: readonly PlayableRect[],
  inset = 0,
) {
  return surfaces.some((surface) => pointInsideSurface(point, surface, inset));
}

export function closestPointOnPlayableSurface(
  point: XzPoint,
  surfaces: readonly PlayableRect[],
) {
  if (positionOnPlayableSurface(point, surfaces)) return { x: point.x, z: point.z };
  let closest = { x: point.x, z: point.z };
  let closestDistance = Infinity;
  surfaces.forEach((surface) => {
    const candidate = {
      x: Math.max(surface.minX, Math.min(surface.maxX, point.x)),
      z: Math.max(surface.minZ, Math.min(surface.maxZ, point.z)),
    };
    const distance = (candidate.x - point.x) ** 2 + (candidate.z - point.z) ** 2;
    if (distance < closestDistance) {
      closest = candidate;
      closestDistance = distance;
    }
  });
  return closest;
}

function rayRectExitDistance(
  origin: XzPoint,
  direction: XzPoint,
  surface: PlayableRect,
) {
  let near = 0;
  let far = Infinity;
  for (const [start, delta, minimum, maximum] of [
    [origin.x, direction.x, surface.minX, surface.maxX],
    [origin.z, direction.z, surface.minZ, surface.maxZ],
  ]) {
    if (Math.abs(delta) < 0.000001) {
      if (start < minimum || start > maximum) return undefined;
      continue;
    }
    const first = (minimum - start) / delta;
    const second = (maximum - start) / delta;
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (near > far) return undefined;
  }
  return far >= 0 ? far : undefined;
}

export function playableRayDistance(
  origin: XzPoint,
  direction: XzPoint,
  surfaces: readonly PlayableRect[],
  maximumDistance: number,
) {
  const length = Math.hypot(direction.x, direction.z);
  if (length <= 0.000001) return 0;
  const normalized = { x: direction.x / length, z: direction.z / length };
  let furthest = 0;
  surfaces.forEach((surface) => {
    const exit = rayRectExitDistance(origin, normalized, surface);
    if (exit !== undefined) furthest = Math.max(furthest, exit);
  });
  return Math.min(maximumDistance, furthest);
}

function surfaceCenter(surface: PlayableRect) {
  return {
    x: (surface.minX + surface.maxX) / 2,
    z: (surface.minZ + surface.maxZ) / 2,
  };
}

export function bridgeInterceptionPoint(
  interceptor: XzPoint,
  player: XzPoint,
  playerVelocity: XzPoint,
  sectors: readonly PlayableRect[],
  bridges: readonly PlayableRect[],
) {
  if (bridges.length === 0) return { x: player.x, z: player.z };
  const occupiedBridge = bridges.find((bridge) => pointInsideSurface(player, bridge));
  const projectedZ = player.z + playerVelocity.z * 1.4;
  const bridge = occupiedBridge ?? bridges.reduce((selected, candidate) => {
    const selectedCenter = surfaceCenter(selected);
    const candidateCenter = surfaceCenter(candidate);
    const selectedCost = Math.abs(projectedZ - selectedCenter.z)
      + Math.abs(interceptor.z - selectedCenter.z) * 0.35;
    const candidateCost = Math.abs(projectedZ - candidateCenter.z)
      + Math.abs(interceptor.z - candidateCenter.z) * 0.35;
    return candidateCost < selectedCost ? candidate : selected;
  });
  const bridgeCenter = surfaceCenter(bridge);
  if (occupiedBridge) return bridgeCenter;

  const playerSector = sectors.find((sector) => pointInsideSurface(player, sector));
  if (!playerSector) return bridgeCenter;
  const playerIsLeft = (playerSector.minX + playerSector.maxX) / 2 < bridgeCenter.x;
  return {
    x: playerIsLeft ? playerSector.maxX - 4 : playerSector.minX + 4,
    z: bridgeCenter.z,
  };
}

export function bridgeRouteWaypoint(
  from: XzPoint,
  target: XzPoint,
  sectors: readonly PlayableRect[],
  bridges: readonly PlayableRect[],
) {
  const targetSectorIndex = sectors.findIndex((sector) => pointInsideSurface(target, sector));
  if (targetSectorIndex < 0) return { x: target.x, z: target.z };
  const fromSectorIndex = sectors.findIndex((sector) => pointInsideSurface(from, sector));
  if (fromSectorIndex === targetSectorIndex) return { x: target.x, z: target.z };

  const occupiedBridge = bridges.find((candidate) => pointInsideSurface(from, candidate));
  const bridge = occupiedBridge ?? bridges.reduce<PlayableRect | undefined>((selected, candidate) => {
    if (!selected) return candidate;
    const selectedCenter = surfaceCenter(selected);
    const candidateCenter = surfaceCenter(candidate);
    const selectedCost = Math.abs(from.z - selectedCenter.z) + Math.abs(target.z - selectedCenter.z);
    const candidateCost = Math.abs(from.z - candidateCenter.z) + Math.abs(target.z - candidateCenter.z);
    return candidateCost < selectedCost ? candidate : selected;
  }, undefined);
  if (!bridge) return { x: target.x, z: target.z };

  const bridgeCenter = surfaceCenter(bridge);
  const targetSector = sectors[targetSectorIndex];
  const targetIsRight = bridgeCenter.x < (targetSector.minX + targetSector.maxX) / 2;
  if (fromSectorIndex >= 0) {
    const fromSector = sectors[fromSectorIndex];
    const fromIsLeft = (fromSector.minX + fromSector.maxX) / 2 < bridgeCenter.x;
    const approach = {
      x: fromIsLeft ? fromSector.maxX - 2.2 : fromSector.minX + 2.2,
      z: bridgeCenter.z,
    };
    const alignedWithBridge = Math.abs(from.z - bridgeCenter.z)
      <= Math.max(0.8, (bridge.maxZ - bridge.minZ) / 2 - 1.8);
    const atApproach = Math.abs(from.x - approach.x) <= 3.2;
    return alignedWithBridge && atApproach ? bridgeCenter : approach;
  }

  return {
    x: targetIsRight ? targetSector.minX + 2.2 : targetSector.maxX - 2.2,
    z: bridgeCenter.z,
  };
}
