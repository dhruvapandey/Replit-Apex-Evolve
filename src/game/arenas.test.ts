import { describe, expect, it } from 'vitest';
import { tankPositionBlocked } from './physics';
import { ARENA_CHOICES, CITY_BUILDING_HEIGHT_SCALE } from './arenas';
import { positionOnPlayableSurface } from './worldTopology';

describe('selectable combat arenas', () => {
  it('offers two genuinely different arena layouts', () => {
    expect(ARENA_CHOICES).toHaveLength(2);
    expect(ARENA_CHOICES.map((arena) => arena.id)).toEqual(['neon-bastion', 'city-island']);
    expect(ARENA_CHOICES[0].cover).not.toEqual(ARENA_CHOICES[1].cover);
  });

  it('builds two full sectors connected by one central bridge', () => {
    ARENA_CHOICES.forEach((arena) => {
      expect(arena.sectors).toHaveLength(2);
      expect(arena.bridges).toHaveLength(1);
      expect((arena.bridges[0].minZ + arena.bridges[0].maxZ) / 2).toBe(0);
      expect(arena.cover).toHaveLength(26);
    });
  });

  it('places exactly three enemy specialists on each island', () => {
    ARENA_CHOICES.forEach((arena) => {
      const spawnX = arena.enemySpawnCoverIndices.map((index) => arena.cover[index][0]);
      expect(spawnX.filter((x) => x < 0)).toHaveLength(3);
      expect(spawnX.filter((x) => x > 0)).toHaveLength(3);
    });
  });

  it('assigns exactly one climbable building to each island', () => {
    ARENA_CHOICES.forEach((arena) => {
      expect(arena.rampBuildingIndices).toHaveLength(2);
      const rampX = arena.rampBuildingIndices.map((index) => arena.cover[index][0]);
      expect(rampX.filter((x) => x < 0)).toHaveLength(1);
      expect(rampX.filter((x) => x > 0)).toHaveLength(1);
    });
  });

  it('keeps all collision blocks on one of the playable sectors', () => {
    ARENA_CHOICES.forEach((arena) => {
      arena.cover.forEach(([x, z, width, , depth]) => {
        expect(positionOnPlayableSurface({ x: x - width / 2, z: z - depth / 2 }, arena.sectors)).toBe(true);
        expect(positionOnPlayableSurface({ x: x + width / 2, z: z + depth / 2 }, arena.sectors)).toBe(true);
      });
    });
  });

  it('keeps each player spawn clear of buildings', () => {
    ARENA_CHOICES.forEach((arena) => {
      const obstacles = arena.cover.map(([x, z, width, , depth]) => ({
        minX: x - width / 2,
        maxX: x + width / 2,
        minZ: z - depth / 2,
        maxZ: z + depth / 2,
      }));
      expect(tankPositionBlocked({ x: arena.playerSpawn[0], z: arena.playerSpawn[1] }, obstacles)).toBe(false);
    });
  });

  it('uses the reduced City Island skyline', () => {
    const city = ARENA_CHOICES.find((arena) => arena.id === 'city-island');
    expect(CITY_BUILDING_HEIGHT_SCALE).toBe(0.72);
    expect(Math.max(...(city?.cover.map(([, , , height]) => height) ?? []))).toBeCloseTo(6.48);
  });
});
