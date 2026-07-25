import { describe, expect, it } from 'vitest';
import {
  createPlaySession,
  getAnalyticsConsent,
  setAnalyticsConsent,
  validGoogleMeasurementId,
} from './analytics';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe('game analytics', () => {
  it('accepts only GA4 measurement identifiers', () => {
    expect(validGoogleMeasurementId('G-ABC123XYZ')).toBe(true);
    expect(validGoogleMeasurementId('UA-1234')).toBe(false);
    expect(validGoogleMeasurementId('G-bad')).toBe(false);
  });

  it('counts repeat play sessions without creating a personal identifier', () => {
    const storage = memoryStorage();
    expect(createPlaySession(storage)).toEqual({ sessionNumber: 1, returningPlayer: false });
    expect(createPlaySession(storage)).toEqual({ sessionNumber: 2, returningPlayer: true });
  });

  it('persists an explicit analytics choice', () => {
    const storage = memoryStorage();
    expect(getAnalyticsConsent(storage)).toBe('unknown');
    setAnalyticsConsent('denied', storage);
    expect(getAnalyticsConsent(storage)).toBe('denied');
  });
});
