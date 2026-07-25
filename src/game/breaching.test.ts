import { describe, expect, it } from 'vitest';
import {
  BREACH_REQUIRED_HITS,
  breachCenterForImpact,
  pointInsideBreach,
  registerBreachHit,
  type BreachProgress,
} from './breaching';

const building = { minX: -4, maxX: 4, minZ: -3, maxZ: 3 };

describe('localized building breaching', () => {
  it('opens a tunnel only after four hits in the same wall area', () => {
    const candidate = breachCenterForImpact({ x: 0, y: 1.2, z: -3 }, building, 5);
    let progress: BreachProgress[] = [];
    for (let hit = 1; hit < BREACH_REQUIRED_HITS; hit += 1) {
      const result = registerBreachHit(progress, candidate);
      progress = result.progress;
      expect(result.hits).toBe(hit);
      expect(result.completed).toBeUndefined();
    }
    const opened = registerBreachHit(progress, candidate);
    expect(opened.completed).toEqual(candidate);
    expect(opened.progress).toHaveLength(0);
  });

  it('tracks hits in different wall areas separately', () => {
    const first = breachCenterForImpact({ x: 0, y: 1.2, z: -3 }, building, 5);
    const second = breachCenterForImpact({ x: 2.4, y: 1.2, z: -3 }, building, 5);
    const started = registerBreachHit([], first);
    const split = registerBreachHit(started.progress, second);
    expect(split.progress).toHaveLength(2);
    expect(split.progress.map((entry) => entry.hits)).toEqual([1, 1]);
  });

  it('lets projectiles pass through the completed tunnel from either side', () => {
    const breach = breachCenterForImpact({ x: 4, y: 1.2, z: 0.4 }, building, 5);
    expect(pointInsideBreach({ x: -4, y: 1.2, z: 0.4 }, breach)).toBe(true);
    expect(pointInsideBreach({ x: 4, y: 1.2, z: 0.4 }, breach)).toBe(true);
    expect(pointInsideBreach({ x: 4, y: 2.3, z: 0.4 }, breach)).toBe(false);
  });

  it('keeps breach centers away from roofs and building corners', () => {
    const breach = breachCenterForImpact({ x: 4, y: 8, z: 2.95 }, building, 5);
    expect(breach.center.y).toBeLessThan(5);
    expect(breach.center.z).toBeLessThan(3);
  });
});
