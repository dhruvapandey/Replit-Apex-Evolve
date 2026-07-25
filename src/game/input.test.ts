import { describe, expect, it } from 'vitest';
import { constrainTacticalPan, tacticalLookAhead } from './input';

describe('tactical mouse look-ahead', () => {
  it('keeps the camera centered while the reticle is near the player', () => {
    expect(tacticalLookAhead(0.1, -0.1)).toEqual({ x: 0, z: 0 });
  });

  it('looks north when the reticle approaches the top edge', () => {
    const lookAhead = tacticalLookAhead(0, 1);
    expect(lookAhead.x).toBeCloseTo(0);
    expect(lookAhead.z).toBeLessThan(0);
  });

  it('looks right when the reticle approaches the right edge', () => {
    const lookAhead = tacticalLookAhead(1, 0);
    expect(lookAhead.x).toBeGreaterThan(0);
    expect(lookAhead.z).toBeCloseTo(0);
  });

  it('never exceeds the safe look-ahead distance', () => {
    const lookAhead = tacticalLookAhead(1, 1);
    expect(Math.hypot(lookAhead.x, lookAhead.z)).toBeCloseTo(9.2);
  });

  it('keeps the tactical camera close enough for the player tank to remain visible', () => {
    const constrained = constrainTacticalPan(30, 40);
    expect(Math.hypot(constrained.x, constrained.z)).toBeCloseTo(11.5);
  });

  it('does not disturb camera movement inside the safe area', () => {
    expect(constrainTacticalPan(4, -6)).toEqual({ x: 4, z: -6 });
  });
});
