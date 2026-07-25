import { describe, expect, it } from 'vitest';
import { ENEMIES_PER_GENERATION, LIVES_PER_GENERATION, livesForGeneration } from './progression';

describe('generation enemy count', () => {
  it('keeps exactly three enemies on each of the two islands', () => {
    expect(ENEMIES_PER_GENERATION).toBe(6);
  });
});

describe('generation life progression', () => {
  it('starts generation one with five lives', () => {
    expect(livesForGeneration(1)).toBe(5);
  });

  it('keeps exactly five lives in every generation', () => {
    expect(LIVES_PER_GENERATION).toBe(5);
    expect(livesForGeneration(2)).toBe(5);
    expect(livesForGeneration(3)).toBe(5);
    expect(livesForGeneration(8)).toBe(5);
  });

  it('uses five lives even for an invalid generation number', () => {
    expect(livesForGeneration(0)).toBe(5);
  });
});
