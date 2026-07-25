import { describe, expect, it } from 'vitest';
import {
  CANNON_MAX_PITCH,
  CANNON_MIN_PITCH,
  cannonDirectionForAngles,
  cannonPitchFromDirection,
  cannonPitchFromPointer,
  convergedCannonTarget,
} from './cannon';

describe('three-dimensional cannon aiming', () => {
  it('fires horizontally at zero degrees', () => {
    expect(cannonDirectionForAngles(0, 0)).toEqual({ x: -0, y: 0, z: -1 });
  });

  it('fires vertically at ninety degrees', () => {
    const direction = cannonDirectionForAngles(0, CANNON_MAX_PITCH);
    expect(direction.y).toBeCloseTo(1);
    expect(Math.hypot(direction.x, direction.z)).toBeCloseTo(0);
  });

  it('supports downward fire for elevated tanks', () => {
    const direction = cannonDirectionForAngles(0, CANNON_MIN_PITCH);
    expect(direction.y).toBeLessThan(-0.8);
    expect(cannonPitchFromDirection(direction)).toBeCloseTo(CANNON_MIN_PITCH);
  });

  it('maps the full vertical mouse range to the cannon limits', () => {
    expect(cannonPitchFromPointer(1)).toBe(CANNON_MAX_PITCH);
    expect(cannonPitchFromPointer(0)).toBe(0);
    expect(cannonPitchFromPointer(-1)).toBe(CANNON_MIN_PITCH);
  });

  it('converges an offset muzzle onto the player view ray', () => {
    expect(convergedCannonTarget(
      { x: 0.6, y: 1, z: -2 },
      { x: 0, y: 1.5, z: 0 },
      { x: 0, y: 0, z: -1 },
      100,
    )).toEqual({ x: -0.6, y: 0.5, z: -98 });
  });
});
