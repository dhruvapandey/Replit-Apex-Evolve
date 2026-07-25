import { describe, expect, it } from 'vitest';
import type { PlayableRect } from './arenas';
import {
  bridgeInterceptionPoint,
  bridgeRouteWaypoint,
  closestPointOnPlayableSurface,
  playableRayDistance,
  positionOnPlayableSurface,
} from './worldTopology';

const sectors: PlayableRect[] = [
  { minX: -85, maxX: -9, minZ: -38, maxZ: 38, kind: 'sector' },
  { minX: 9, maxX: 85, minZ: -38, maxZ: 38, kind: 'sector' },
];
const bridges: PlayableRect[] = [
  { minX: -9, maxX: 9, minZ: -5, maxZ: 5, kind: 'bridge' },
];
const surfaces = [...sectors, ...bridges];

describe('dual-sector arena topology', () => {
  it('allows tanks on sectors and bridges but rejects the surrounding gap', () => {
    expect(positionOnPlayableSurface({ x: -40, z: 20 }, surfaces)).toBe(true);
    expect(positionOnPlayableSurface({ x: 0, z: 0 }, surfaces)).toBe(true);
    expect(positionOnPlayableSurface({ x: 0, z: 20 }, surfaces)).toBe(false);
  });

  it('routes cross-sector movement through approach, bridge, and exit waypoints', () => {
    expect(bridgeRouteWaypoint({ x: -40, z: 24 }, { x: 40, z: -18 }, sectors, bridges))
      .toEqual({ x: -11.2, z: 0 });
    expect(bridgeRouteWaypoint({ x: -11.2, z: 0 }, { x: 40, z: -18 }, sectors, bridges))
      .toEqual({ x: 0, z: 0 });
    expect(bridgeRouteWaypoint({ x: 0, z: 0 }, { x: 40, z: -18 }, sectors, bridges))
      .toEqual({ x: 11.2, z: 0 });
  });

  it('lets the interceptor predict and guard the likely bridge mouth', () => {
    expect(bridgeInterceptionPoint(
      { x: 50, z: -20 },
      { x: -47, z: 20 },
      { x: 0, z: -12 },
      sectors,
      bridges,
    )).toEqual({ x: -13, z: 0 });
    expect(bridgeInterceptionPoint(
      { x: 50, z: -20 },
      { x: 0, z: 1 },
      { x: 8, z: 0 },
      sectors,
      bridges,
    )).toEqual({ x: 0, z: 0 });
  });

  it('lets mortar range cross water and reach the second sector', () => {
    expect(playableRayDistance({ x: -47, z: 20 }, { x: 1, z: 0 }, surfaces, 200)).toBe(132);
    expect(playableRayDistance({ x: -47, z: 20 }, { x: 0, z: 1 }, surfaces, 200)).toBe(18);
  });

  it('snaps a water target to the nearest playable shoreline or bridge', () => {
    expect(closestPointOnPlayableSurface({ x: 0, z: 20 }, surfaces)).toEqual({ x: -9, z: 20 });
    expect(closestPointOnPlayableSurface({ x: 0, z: 2 }, surfaces)).toEqual({ x: 0, z: 2 });
  });
});
