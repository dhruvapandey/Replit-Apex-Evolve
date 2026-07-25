import { describe, expect, it } from 'vitest';
import { enemyCombatOutcomeFitness, enemyPresenceFitness } from './enemyFitness';

describe('enemy combat fitness', () => {
  it('rewards actual damage far more than firing or missing', () => {
    expect(enemyCombatOutcomeFitness('cannon-hit')).toBe(45);
    expect(enemyCombatOutcomeFitness('mortar-hit')).toBe(55);
    expect(enemyCombatOutcomeFitness('cannon-miss')).toBeLessThan(0);
    expect(enemyCombatOutcomeFitness('mortar-miss')).toBeLessThan(0);
  });

  it('rewards survival, useful range, and real pressure', () => {
    const passive = enemyPresenceFitness(1, false, false, false);
    const effective = enemyPresenceFitness(1, true, true, true);
    expect(passive).toBeCloseTo(0.22);
    expect(effective).toBeCloseTo(0.5);
  });

  it('rewards a successful cannon dodge', () => {
    expect(enemyCombatOutcomeFitness('cannon-dodge')).toBeGreaterThan(0);
  });
});
