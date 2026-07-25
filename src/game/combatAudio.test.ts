import { describe, expect, it } from 'vitest';
import { COMBAT_SAMPLE_URLS, soundVolumeForDistance } from './combatAudio';

describe('spatial combat audio', () => {
  it('is full volume at the listener and silent beyond its range', () => {
    expect(soundVolumeForDistance(0)).toBe(1);
    expect(soundVolumeForDistance(72)).toBe(0);
    expect(soundVolumeForDistance(120)).toBe(0);
  });

  it('falls away smoothly with distance', () => {
    const near = soundVolumeForDistance(12);
    const medium = soundVolumeForDistance(36);
    const far = soundVolumeForDistance(60);
    expect(near).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(far);
  });

  it('uses recorded combat layers for the major weapon events', () => {
    expect(Object.keys(COMBAT_SAMPLE_URLS)).toEqual([
      'cannon',
      'gunfire',
      'artillery',
      'explosion',
    ]);
    Object.values(COMBAT_SAMPLE_URLS).forEach((url) => {
      expect(url).toMatch(/^https:\/\/cdn\.freesound\.org\/previews\//);
    });
  });
});
