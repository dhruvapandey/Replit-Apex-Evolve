import { describe, expect, it } from 'vitest';
import {
  allowsExternalSupport,
  allowsGoogleAnalytics,
  normalizeDistributionTarget,
} from './distribution';

describe('distribution policy', () => {
  it('normalizes unknown targets to the direct web build', () => {
    expect(normalizeDistributionTarget(undefined)).toBe('web');
    expect(normalizeDistributionTarget('unknown')).toBe('web');
    expect(normalizeDistributionTarget('crazygames')).toBe('crazygames');
  });

  it('keeps external funding out of portal and premium builds', () => {
    expect(allowsExternalSupport('web')).toBe(true);
    expect(allowsExternalSupport('itch')).toBe(false);
    expect(allowsExternalSupport('crazygames')).toBe(false);
    expect(allowsExternalSupport('steam')).toBe(false);
  });

  it('uses first-party platform analytics on CrazyGames and Steam', () => {
    expect(allowsGoogleAnalytics('web')).toBe(true);
    expect(allowsGoogleAnalytics('itch')).toBe(true);
    expect(allowsGoogleAnalytics('crazygames')).toBe(false);
    expect(allowsGoogleAnalytics('steam')).toBe(false);
  });
});
