import { describe, expect, it } from 'vitest';
import { tankPositionBlocked } from './physics';
import {
  createRampOverpass,
  rampClearsBuilding,
  rampElevationAt,
  rampMovementDecision,
} from './ramps';

const ramp = createRampOverpass(4, [-47, -24, 12, 4, 6]);

describe('single-building ramp overpass', () => {
  it('climbs from one entry, crosses the roof, and descends through one exit', () => {
    expect(rampElevationAt({ x: -63, z: -24 }, [ramp])).toBe(0);
    expect(rampElevationAt({ x: -58, z: -24 }, [ramp])).toBeCloseTo(ramp.topHeight / 2);
    expect(rampElevationAt({ x: -47, z: -24 }, [ramp])).toBe(ramp.topHeight);
    expect(rampElevationAt({ x: -36, z: -24 }, [ramp])).toBeCloseTo(ramp.topHeight / 2);
    expect(rampElevationAt({ x: -31, z: -24 }, [ramp])).toBe(0);
  });

  it('only clears the selected building while the tank is on its roof lane', () => {
    expect(rampClearsBuilding({ x: -47, z: -24 }, ramp.topHeight, 4, [ramp])).toBe(true);
    expect(rampClearsBuilding({ x: -47, z: -20 }, ramp.topHeight, 4, [ramp])).toBe(false);
    expect(rampClearsBuilding({ x: -47, z: -24 }, ramp.topHeight, 5, [ramp])).toBe(false);
  });

  it('accounts for the full tank footprint at the entry and exit walls', () => {
    const entryX = ramp.centerX - ramp.buildingWidth / 2 - 1.4;
    const exitX = ramp.centerX + ramp.buildingWidth / 2 + 1.4;
    expect(rampClearsBuilding(
      { x: entryX, z: ramp.centerZ },
      rampElevationAt({ x: entryX, z: ramp.centerZ }, [ramp]),
      ramp.coverIndex,
      [ramp],
    )).toBe(true);
    expect(rampClearsBuilding(
      { x: exitX, z: ramp.centerZ },
      rampElevationAt({ x: exitX, z: ramp.centerZ }, [ramp]),
      ramp.coverIndex,
      [ramp],
    )).toBe(true);
  });

  it('allows uninterrupted movement from the entry through the roof to the exit', () => {
    const building = {
      minX: ramp.centerX - ramp.buildingWidth / 2,
      maxX: ramp.centerX + ramp.buildingWidth / 2,
      minZ: ramp.centerZ - ramp.buildingDepth / 2,
      maxZ: ramp.centerZ + ramp.buildingDepth / 2,
    };
    let point = { x: -64, z: ramp.centerZ };
    let activeCoverIndex: number | undefined;
    for (let x = -63.9; x <= -30; x += 0.1) {
      const next = { x, z: ramp.centerZ };
      const movement = rampMovementDecision(point, next, activeCoverIndex, [ramp]);
      expect(movement.allowed).toBe(true);
      activeCoverIndex = movement.activeCoverIndex;
      point = next;
      const elevation = rampElevationAt(point, [ramp]);
      const obstacles = rampClearsBuilding(point, elevation, ramp.coverIndex, [ramp])
        ? []
        : [building];
      expect(tankPositionBlocked(point, obstacles)).toBe(false);
    }
    expect(activeCoverIndex).toBeUndefined();
  });

  it('blocks side entry but permits entry across the bottom start line', () => {
    const sideEntry = rampMovementDecision(
      { x: -58, z: -28 },
      { x: -58, z: -26 },
      undefined,
      [ramp],
    );
    expect(sideEntry.allowed).toBe(false);

    const bottomEntry = rampMovementDecision(
      { x: -63.1, z: -24 },
      { x: -62.9, z: -24 },
      undefined,
      [ramp],
    );
    expect(bottomEntry.allowed).toBe(true);
    expect(bottomEntry.activeCoverIndex).toBe(ramp.coverIndex);
  });

  it('keeps an active tank between the rails until it exits at the far bottom', () => {
    const sideExit = rampMovementDecision(
      { x: -47, z: -24 },
      { x: -47, z: -26.8 },
      ramp.coverIndex,
      [ramp],
    );
    expect(sideExit.allowed).toBe(false);

    const endExit = rampMovementDecision(
      { x: -31.1, z: -24 },
      { x: -30.9, z: -24 },
      ramp.coverIndex,
      [ramp],
    );
    expect(endExit).toEqual({ allowed: true, elevation: 0 });
  });
});
