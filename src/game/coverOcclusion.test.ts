import { describe, expect, it } from 'vitest';
import { ARENA_CONFIGS } from './arenas';
import type { BuildingBreach } from './breaching';
import { effectBlockedByCover } from './coverOcclusion';
import { createRampOverpass } from './ramps';

const wall = {
  minX: 4,
  maxX: 8,
  minZ: -2,
  maxZ: 2,
  height: 4,
  breaches: [] as BuildingBreach[],
};

describe('combat effect cover occlusion', () => {
  it('blocks a ground-level blast travelling through a wall', () => {
    expect(effectBlockedByCover(
      { x: 0, y: 0.14, z: 0 },
      { x: 10, y: 0, z: 0 },
      [wall],
    )).toBe(true);
  });

  it('does not block an effect path that clears a low obstacle', () => {
    expect(effectBlockedByCover(
      { x: 0, y: 6, z: 0 },
      { x: 10, y: 6, z: 0 },
      [{ ...wall, height: 2 }],
    )).toBe(false);
  });

  it('blocks a rising sightline when any part still crosses the building', () => {
    expect(effectBlockedByCover(
      { x: 0, y: 1.12, z: 0 },
      { x: 10, y: 8, z: 0 },
      [wall],
      () => [],
      0,
      0,
    )).toBe(true);
  });

  it('gives both tanks reciprocal sight when an elevated line clears the roof', () => {
    const groundTank = { x: 0, y: 1.12, z: 0 };
    const elevatedTank = { x: 10, y: 10, z: 0 };
    expect(effectBlockedByCover(
      groundTank,
      elevatedTank,
      [wall],
      () => [],
      0,
      0,
    )).toBe(false);
    expect(effectBlockedByCover(
      elevatedTank,
      groundTank,
      [wall],
      () => [],
      0,
      0,
    )).toBe(false);
  });

  it('gives reciprocal sight to a tank on the real City Island ramp roof', () => {
    const arena = ARENA_CONFIGS['city-island'];
    const coverIndex = arena.rampBuildingIndices[0];
    const cover = arena.cover[coverIndex];
    const ramp = createRampOverpass(coverIndex, cover);
    const [centerX, centerZ, width, height, depth] = cover;
    const rampBuilding = {
      minX: centerX - width / 2,
      maxX: centerX + width / 2,
      minZ: centerZ - depth / 2,
      maxZ: centerZ + depth / 2,
      height,
    };
    const groundEnemySight = {
      x: rampBuilding.maxX + ramp.approachLength + 1,
      y: 1.12,
      z: centerZ,
    };
    const roofPlayerSight = {
      x: centerX,
      y: ramp.topHeight + 0.85,
      z: centerZ,
    };

    expect(effectBlockedByCover(
      groundEnemySight,
      roofPlayerSight,
      [rampBuilding],
      () => [],
      0,
      0,
    )).toBe(false);
    expect(effectBlockedByCover(
      roofPlayerSight,
      groundEnemySight,
      [rampBuilding],
      () => [],
      0,
      0,
    )).toBe(false);
  });

  it('allows an effect through a completed aligned building breach', () => {
    const breachedWall = {
      ...wall,
      breaches: [{
        axis: 'x' as const,
        center: { x: 6, y: 0.5, z: 0 },
      }],
    };
    expect(effectBlockedByCover(
      { x: 0, y: 0.14, z: 0 },
      { x: 10, y: 0, z: 0 },
      [breachedWall],
      (obstacle) => obstacle.breaches,
      0.72,
    )).toBe(false);
  });
});
