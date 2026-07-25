import { describe, expect, it } from 'vitest';
import {
  completionPercentageForWave,
  shouldLoadCrazyGamesSdk,
} from './crazyGames';

describe('CrazyGames integration policy', () => {
  it('loads for portal builds, CrazyGames hosts, and explicit local previews', () => {
    expect(shouldLoadCrazyGamesSdk('crazygames', 'files.example.com', '')).toBe(true);
    expect(shouldLoadCrazyGamesSdk('web', 'games.crazygames.com', '')).toBe(true);
    expect(shouldLoadCrazyGamesSdk('web', 'example.com', '?useLocalSdk=true')).toBe(true);
    expect(shouldLoadCrazyGamesSdk('web', 'example.com', '')).toBe(false);
  });

  it('reports a consistent ten-wave completion milestone', () => {
    expect(completionPercentageForWave(0)).toBe(0);
    expect(completionPercentageForWave(4)).toBe(40);
    expect(completionPercentageForWave(10)).toBe(100);
    expect(completionPercentageForWave(30)).toBe(100);
  });
});
