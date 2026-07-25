import { describe, expect, it } from 'vitest';
import {
  ARENA_CONFIGS,
  RIGHT_SECTOR_CENTER_X,
} from './arenas';
import {
  CANNON_MAX_PITCH,
  cannonPitchFromDirection,
} from './cannon';
import { effectBlockedByCover } from './coverOcclusion';
import { duelMovementIntent } from './duelAi';
import { enemyCannonInRange } from './enemyAi';
import { projectileHitsObstacle } from './physics';
import { createRampOverpass } from './ramps';

describe('directed City Island ramp combat', () => {
  it('lets the distant Duel enemy see, aim up, and fire instead of crossing', () => {
    const arena = ARENA_CONFIGS['city-island'];
    const coverIndex = arena.rampBuildingIndices[0];
    const ramp = createRampOverpass(coverIndex, arena.cover[coverIndex]);
    // This narrow lane is the real unobstructed cross-island firing angle
    // between the two buildings that flank the central ramp sightline.
    const combatZ = ramp.centerZ - 0.25;
    const obstacles = arena.cover.map(([x, z, width, height, depth]) => ({
      minX: x - width / 2,
      maxX: x + width / 2,
      minZ: z - depth / 2,
      maxZ: z + depth / 2,
      height,
    }));
    const enemyMuzzle = {
      x: RIGHT_SECTOR_CENTER_X,
      y: 1.12,
      z: combatZ,
    };
    const playerCenter = {
      x: ramp.centerX,
      y: ramp.topHeight + 0.85,
      z: combatZ,
    };
    const horizontalDistance = Math.hypot(
      playerCenter.x - enemyMuzzle.x,
      playerCenter.z - enemyMuzzle.z,
    );
    const directionToPlayer = {
      x: playerCenter.x - enemyMuzzle.x,
      y: playerCenter.y - enemyMuzzle.y,
      z: playerCenter.z - enemyMuzzle.z,
    };
    const upwardPitch = cannonPitchFromDirection(directionToPlayer);
    const hasReciprocalSight = !effectBlockedByCover(
      enemyMuzzle,
      playerCenter,
      obstacles,
      () => [],
      0,
      0,
    ) && !effectBlockedByCover(
      playerCenter,
      enemyMuzzle,
      obstacles,
      () => [],
      0,
      0,
    );
    const trajectory = Array.from({ length: 201 }, (_, index) => {
      const amount = index / 200;
      return {
        x: enemyMuzzle.x + directionToPlayer.x * amount,
        y: enemyMuzzle.y + directionToPlayer.y * amount,
        z: enemyMuzzle.z + directionToPlayer.z * amount,
      };
    });
    const blockingCoverIndices = obstacles.flatMap((obstacle, obstacleIndex) => (
      trajectory.some((point) => (
        point.y <= obstacle.height
        && projectileHitsObstacle(point, [obstacle])
      ))
        ? [obstacleIndex]
        : []
    ));

    expect(horizontalDistance).toBeLessThanOrEqual(112);
    expect(enemyCannonInRange(horizontalDistance)).toBe(true);
    expect(blockingCoverIndices).toEqual([]);
    expect(hasReciprocalSight).toBe(true);
    expect(upwardPitch).toBeGreaterThan(0);
    expect(upwardPitch).toBeLessThan(CANNON_MAX_PITCH);
    expect(duelMovementIntent(
      horizontalDistance,
      hasReciprocalSight,
      enemyCannonInRange(horizontalDistance),
    )).toBe('pressure');
  });
});
