import { describe, expect, it } from 'vitest';
import {
  constrainTacticalPan,
  isHeldCombatKey,
  isRestartRunKey,
  shouldSuppressCombatKey,
  tacticalLookAhead,
} from './input';

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

describe('combat keyboard safety', () => {
  it('only stores keys that represent continuous movement', () => {
    expect(isHeldCombatKey('KeyW')).toBe(true);
    expect(isHeldCombatKey('ShiftRight')).toBe(true);
    expect(isHeldCombatKey('KeyQ')).toBe(false);
    expect(isHeldCombatKey('Tab')).toBe(false);
  });

  it.each(['Tab', 'Backquote', 'Digit1', 'Digit2'])(
    'suppresses the nearby accidental %s key during active combat',
    (code) => {
      expect(shouldSuppressCombatKey(code)).toBe(true);
    },
  );

  it('does not swallow unrelated browser shortcuts', () => {
    expect(shouldSuppressCombatKey('KeyL')).toBe(false);
    expect(shouldSuppressCombatKey('F5')).toBe(false);
  });

  it('restarts only on a fresh Enter press', () => {
    expect(isRestartRunKey('Enter', false)).toBe(true);
    expect(isRestartRunKey('Enter', true)).toBe(false);
    expect(isRestartRunKey('Space', false)).toBe(false);
  });
});
