import { describe, expect, it } from 'vitest';
import {
  projectileHitsObstacle,
  projectileHitsTank,
  lineOfSightBlocked,
  segmentObstacleIntersection,
  tankPositionBlocked,
  type ArenaObstacle,
} from './physics';

const wall: ArenaObstacle = { minX: 4, maxX: 8, minZ: -2, maxZ: 2 };

describe('arena collision helpers', () => {
  it('blocks a tank before its center enters a wall', () => {
    expect(tankPositionBlocked({ x: 3, z: 0 }, [wall])).toBe(true);
    expect(tankPositionBlocked({ x: 2, z: 0 }, [wall])).toBe(false);
  });

  it('lets tanks move freely away from cover', () => {
    expect(tankPositionBlocked({ x: -10, z: 12 }, [wall])).toBe(false);
  });

  it('stops projectiles when they enter cover', () => {
    expect(projectileHitsObstacle({ x: 6, z: 0 }, [wall])).toBe(true);
    expect(projectileHitsObstacle({ x: 6, z: 3 }, [wall])).toBe(false);
  });

  it('uses a horizontal hitbox so correct-height shots hit tanks', () => {
    expect(projectileHitsTank({ x: 0, z: 1.5 }, { x: 0, z: 0 })).toBe(true);
    expect(projectileHitsTank({ x: 0, z: 2.2 }, { x: 0, z: 0 })).toBe(false);
  });

  it('lets angled cannon shots pass safely above or below a tank', () => {
    expect(projectileHitsTank({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(true);
    expect(projectileHitsTank({ x: 0, y: 4, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(false);
    expect(projectileHitsTank({ x: 0, y: 5.6, z: 0 }, { x: 0, y: 4.8, z: 0 })).toBe(true);
  });

  it('detects when cover blocks an enemy firing line', () => {
    expect(lineOfSightBlocked({ x: 10, z: 0 }, { x: 0, z: 0 }, [wall])).toBe(true);
    expect(lineOfSightBlocked({ x: 10, z: 5 }, { x: 0, z: 5 }, [wall])).toBe(false);
  });

  it('reports where a flight path enters and exits an obstacle', () => {
    expect(segmentObstacleIntersection(
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      wall,
    )).toEqual({ near: 0.4, far: 0.8 });
    expect(segmentObstacleIntersection(
      { x: 0, z: 5 },
      { x: 10, z: 5 },
      wall,
    )).toBeNull();
  });
});
