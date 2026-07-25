import { describe, expect, it } from 'vitest';
import { blastDamageForObstacle, distanceToObstacle } from './environmentDamage';

const building = { minX: -3, maxX: 3, minZ: -2, maxZ: 2 };

describe('environment blast damage', () => {
  it('measures from the building edge instead of its center', () => {
    expect(distanceToObstacle({ x: 4, z: 2 }, building)).toBe(1);
    expect(distanceToObstacle({ x: 0, z: 0 }, building)).toBe(0);
  });

  it('damages nearby buildings and ignores structures outside the blast', () => {
    expect(blastDamageForObstacle({ x: 0, z: 0 }, building, 6, 4)).toBe(4);
    expect(blastDamageForObstacle({ x: 7, z: 0 }, building, 6, 4)).toBeGreaterThan(0);
    expect(blastDamageForObstacle({ x: 10, z: 0 }, building, 6, 4)).toBe(0);
  });
});
